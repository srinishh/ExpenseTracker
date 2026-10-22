import type { AppData } from './types'

export interface SheetConfig {
  url: string
  token: string
}

const KEY = 'family-finance:sheet'

export function loadSheetConfig(): SheetConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSheetConfig(cfg: SheetConfig | null) {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg))
    else localStorage.removeItem(KEY)
  } catch { /* storage unavailable */ }
}

async function parse(res: Response) {
  if (!res.ok) throw new Error(`Google returned ${res.status}`)
  let body: { ok: boolean; error?: string; data?: AppData | null; savedAt?: string }
  try {
    body = await res.json()
  } catch {
    throw new Error('Unexpected response. Check the web app URL ends in /exec and access is set to "Anyone".')
  }
  if (!body.ok) throw new Error(body.error ?? 'Sheet request failed')
  return body
}

/** Returns the stored data, or null if the sheet has never been written to. */
export async function pullFromSheet(cfg: SheetConfig): Promise<AppData | null> {
  const res = await fetch(`${cfg.url}?token=${encodeURIComponent(cfg.token)}`, { redirect: 'follow' })
  return (await parse(res)).data ?? null
}

// text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer
export async function pushToSheet(cfg: SheetConfig, data: AppData) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: cfg.token, data }),
    redirect: 'follow',
  })
  return (await parse(res)).savedAt
}

/** Fire-and-forget save used when the page is closing. */
export function beaconToSheet(cfg: SheetConfig, data: AppData) {
  const blob = new Blob([JSON.stringify({ token: cfg.token, data })], { type: 'text/plain;charset=utf-8' })
  return navigator.sendBeacon?.(cfg.url, blob)
}

export function isValidScriptUrl(url: string) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim())
}
