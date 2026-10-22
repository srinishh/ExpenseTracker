import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppData } from './types'
import { emptyData, sampleData } from './sample'
import { setCurrency } from './utils'
import { beaconToSheet, loadSheetConfig, pullFromSheet, pushToSheet, saveSheetConfig, type SheetConfig } from './sheets'

const KEY = 'family-finance:v1'
const PUSH_DELAY = 1500

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyData(), ...JSON.parse(raw) }
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
    try {
      await pushToSheet(cfg, dataRef.current)
      setSync({ state: 'saved', at: Date.now() })
    } catch (e) {
      setSync({ state: 'error', message: (e as Error).message })
    }
  }, [])

  const pull = useCallback(async () => {
    const cfg = sheetRef.current
    if (!cfg) return
    setSync({ state: 'loading' })
    try {
      const remote = await pullFromSheet(cfg)
      remoteReady.current = true
      if (remote) {
        applyRemote(remote)
        setSync({ state: 'saved', at: Date.now() })
      } else {
        await push() // empty sheet: seed it with this device's data
      }
    } catch (e) {
      setSync({ state: 'error', message: (e as Error).message })
    }
  }, [applyRemote, push])

  // Initial load from the sheet
  useEffect(() => {
    if (sheetRef.current) pull()
  }, [pull])

  // Persist locally, and schedule a sheet save after each change
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore quota / private mode */ }
    if (skipPush.current) { skipPush.current = false; return }
    if (!sheetRef.current || !remoteReady.current) return
    window.clearTimeout(pushTimer.current)
    setSync(s => ({ ...s, state: 'saving' }))
    pushTimer.current = window.setTimeout(push, PUSH_DELAY)
  }, [data, push])

  // Flush pending saves on close; pick up other family members' edits when returning to the tab
  useEffect(() => {
    const onHide = () => {
      if (pushTimer.current !== undefined && sheetRef.current) {
        window.clearTimeout(pushTimer.current)
        pushTimer.current = undefined
        beaconToSheet(sheetRef.current, dataRef.current)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sheetRef.current && remoteReady.current && pushTimer.current === undefined) pull()
      else if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pull])

  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.settings.theme)
  }, [data.settings.theme])

  const update = useCallback((fn: (draft: AppData) => void) => {
    setData(prev => {
      const next = structuredClone(prev)
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
    if (mode === 'pull') await pull()
    else await push()
  }, [pull, push])

  const disconnectSheet = useCallback(() => {
    window.clearTimeout(pushTimer.current)
    pushTimer.current = undefined
    saveSheetConfig(null)
    sheetRef.current = null
    remoteReady.current = false
    setSheet(null)
    setSync({ state: 'off' })
  }, [])

  return (
    <StoreContext.Provider value={{
      data, update, replace, sheet, sync, connectSheet, disconnectSheet, reloadFromSheet: pull, saveToSheetNow: push,
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
