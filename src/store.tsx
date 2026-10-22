import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppData } from './types'
import { emptyData, sampleData } from './sample'
import { setCurrency } from './utils'

const KEY = 'family-finance:v1'

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyData(), ...JSON.parse(raw) }
  } catch { /* storage unavailable or corrupt: fall back to sample data */ }
  return sampleData()
}

interface Store {
  data: AppData
  update: (fn: (draft: AppData) => void) => void
  replace: (data: AppData) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  setCurrency(data.settings.currency)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore quota / private mode */ }
  }, [data])

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

  const replace = useCallback((d: AppData) => setData({ ...emptyData(), ...d }), [])

  return <StoreContext.Provider value={{ data, update, replace }}>{children}</StoreContext.Provider>
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
