import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppData } from './types'
import { emptyData, sampleData } from './sample'
import { setCurrency } from './utils'
import { beaconToSheet, loadSheetConfig, pullFromSheet, pushToSheet, saveSheetConfig, type SheetConfig } from './sheets'

const KEY = 'family-finance:v1'
const DIRTY_KEY = 'family-finance:unsynced'
const PUSH_DELAY = 1500
const RETRY_DELAY = 15000
const BEACON_LIMIT = 60000 // sendBeacon silently drops payloads over ~64 KB

function readDirty() {
  try { return localStorage.getItem(DIRTY_KEY) === '1' } catch { return false }
}

// structuredClone is missing on older phones (iOS < 15.4); the data is plain JSON anyway
const clone = <T,>(v: T): T => typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* storage unavailable or corrupt: fall back to sample data */ }
  return sampleData()
}

function normalize(d: Partial<AppData> & { savedAt?: string }): AppData {
  const { savedAt: _ignored, ...rest } = d
  const base = emptyData()
  return { ...base, ...rest, settings: { ...base.settings, ...rest.settings } }
}

export type SyncState = 'off' | 'loading' | 'saving' | 'saved' | 'error'
export interface SyncStatus {
  state: SyncState
  message?: string
  at?: number
}

interface Store {
  data: AppData
  update: (fn: (draft: AppData) => void) => void
  replace: (data: AppData) => void
  sheet: SheetConfig | null
  sync: SyncStatus
  connectSheet: (cfg: SheetConfig, mode: 'pull' | 'push') => Promise<void>
  disconnectSheet: () => void
  reloadFromSheet: () => Promise<void>
  saveToSheetNow: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [sheet, setSheet] = useState<SheetConfig | null>(loadSheetConfig)
  const [sync, setSync] = useState<SyncStatus>({ state: sheet ? 'loading' : 'off' })
  setCurrency(data.settings.currency)

  const dataRef = useRef(data)
  dataRef.current = data
  const sheetRef = useRef(sheet)
  sheetRef.current = sheet
  // Never push until we've read the sheet once, so a stale device can't overwrite newer family data
  const remoteReady = useRef(false)
  const skipPush = useRef(false)
  const pushTimer = useRef<number | undefined>(undefined)
  // True while this device has changes the sheet hasn't confirmed. Persisted so a reload or crash
  // can't let an older sheet copy overwrite them: while dirty we always push before we pull.
  const dirty = useRef(readDirty())
  const setDirty = useCallback((v: boolean) => {
    dirty.current = v
    try { if (v) localStorage.setItem(DIRTY_KEY, '1'); else localStorage.removeItem(DIRTY_KEY) } catch { /* storage unavailable */ }
  }, [])

  const applyRemote = useCallback((remote: AppData) => {
    skipPush.current = true
    setData(normalize(remote))
  }, [])

  const push = useCallback(async () => {
    const cfg = sheetRef.current
    if (!cfg) return
    window.clearTimeout(pushTimer.current)
    pushTimer.current = undefined
    setSync({ state: 'saving' })
    const snapshot = dataRef.current
    try {
      await pushToSheet(cfg, snapshot)
      remoteReady.current = true
      // Edits made while the request was in flight have their own save scheduled
      if (dataRef.current === snapshot) setDirty(false)
      setSync({ state: 'saved', at: Date.now() })
    } catch (e) {
      setSync({ state: 'error', message: `${(e as Error).message}. Your changes are kept on this device and will retry.` })
      if (pushTimer.current === undefined) pushTimer.current = window.setTimeout(() => pushRef.current(), RETRY_DELAY)
    }
  }, [setDirty])
  const pushRef = useRef(push)
  pushRef.current = push

  /** Loads the sheet, unless this device has unsaved changes: then those are saved first and win. */
  const pull = useCallback(async (force = false) => {
    const cfg = sheetRef.current
    if (!cfg) return
    if (dirty.current && !force) return push()
    setSync({ state: 'loading' })
    try {
      const remote = await pullFromSheet(cfg)
      remoteReady.current = true
      if (dirty.current && !force) return push() // edited while loading
      if (remote) {
        setDirty(false)
        applyRemote(remote)
        setSync({ state: 'saved', at: Date.now() })
      } else {
        await push() // empty sheet: seed it with this device's data
      }
    } catch (e) {
      setSync({ state: 'error', message: (e as Error).message })
    }
  }, [applyRemote, push, setDirty])

  // Initial load from the sheet
  useEffect(() => {
    if (sheetRef.current) pull()
  }, [pull])

  // Persist locally, and schedule a sheet save after each change
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore quota / private mode */ }
    if (skipPush.current) { skipPush.current = false; return }
    if (!sheetRef.current) return
    setDirty(true)
    if (!remoteReady.current) return // the initial load will push this instead of overwriting it
    window.clearTimeout(pushTimer.current)
    setSync(s => ({ ...s, state: 'saving' }))
    pushTimer.current = window.setTimeout(push, PUSH_DELAY)
  }, [data, push, setDirty])

  // Flush pending saves on close; pick up other family members' edits when returning to the tab
  useEffect(() => {
    // Best effort only: the change stays marked dirty, so coming back pushes it again rather than pulling over it
    const onHide = () => {
      if (!dirty.current || !sheetRef.current) return
      const payload = JSON.stringify(dataRef.current)
      if (payload.length < BEACON_LIMIT) beaconToSheet(sheetRef.current, dataRef.current)
    }
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return onHide()
      if (sheetRef.current && remoteReady.current && pushTimer.current === undefined) pull()
    }
    const onOnline = () => { if (dirty.current && sheetRef.current) push() }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pull, push])

  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.settings.theme)
  }, [data.settings.theme])

  const update = useCallback((fn: (draft: AppData) => void) => {
    setData(prev => {
      const next = clone(prev)
      fn(next)
      return next
    })
  }, [])

  const replace = useCallback((d: AppData) => setData(normalize(d)), [])

  const connectSheet = useCallback(async (cfg: SheetConfig, mode: 'pull' | 'push') => {
    const clean = { url: cfg.url.trim(), token: cfg.token }
    saveSheetConfig(clean)
    sheetRef.current = clean
    setSheet(clean)
    remoteReady.current = true
    if (mode === 'pull') await pull(true)
    else await push()
  }, [pull, push])

  const disconnectSheet = useCallback(() => {
    window.clearTimeout(pushTimer.current)
    pushTimer.current = undefined
    saveSheetConfig(null)
    sheetRef.current = null
    remoteReady.current = false
    setDirty(false)
    setSheet(null)
    setSync({ state: 'off' })
  }, [setDirty])

  return (
    <StoreContext.Provider value={{
      data, update, replace, sheet, sync, connectSheet, disconnectSheet, reloadFromSheet: () => pull(true), saveToSheetNow: push,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside provider')
  return s
}

export function useMember() {
  const { data } = useStore()
  return (id?: string) => data.members.find(m => m.id === id)
}
