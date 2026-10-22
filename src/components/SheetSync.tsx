import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Card, Field } from './ui'
import { isValidScriptUrl, pullFromSheet } from '../sheets'
import type { AppData } from '../types'
import scriptSource from '../../google-sheets/Code.gs?raw'

function ago(at?: number) {
  if (!at) return ''
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

/** Compact status pill for the sidebar. */
export function SyncBadge() {
  const { sync, sheet } = useStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => tick(n => n + 1), 30000)
    return () => window.clearInterval(t)
  }, [])
  if (!sheet) return null
  const label = {
    off: '', loading: 'Loading from sheet…', saving: 'Saving…', error: 'Sync error', saved: `Synced ${ago(sync.at)}`,
  }[sync.state]
  return (
    <a href="#/settings" className={`sync-badge sync-${sync.state}`} title={sync.message ?? 'Google Sheets sync'}>
      <span className="sync-dot" />
      <span>{label}</span>
    </a>
  )
}

export function SheetSettings() {
  const { sheet, sync, connectSheet, disconnectSheet, reloadFromSheet, saveToSheetNow } = useStore()
  const [url, setUrl] = useState(sheet?.url ?? '')
  const [token, setToken] = useState(sheet?.token ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<AppData | null>(null)
  const [copied, setCopied] = useState(false)

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSource)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Open google-sheets/Code.gs from the repo instead.')
    }
  }

  const test = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setFound(null)
    if (!isValidScriptUrl(url)) return setError('The URL should look like https://script.google.com/macros/s/…/exec')
    setBusy(true)
    try {
      const remote = await pullFromSheet({ url: url.trim(), token })
      if (remote && (remote.members?.length || remote.expenses?.length || remote.incomes?.length)) setFound(remote)
      else await connectSheet({ url, token }, 'push')
    } catch (err) {
      setError((err as Error).message === 'Failed to fetch'
        ? 'Could not reach the script. Check the URL and that access is set to "Anyone".'
        : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const choose = async (mode: 'pull' | 'push') => {
    if (mode === 'push' && !confirm('Overwrite the data in the Google Sheet with the data on this device?')) return
    setBusy(true)
    await connectSheet({ url, token }, mode)
    setFound(null); setBusy(false)
  }

  if (sheet) {
    return (
      <Card title="☁️ Google Sheets sync" className="span-all">
        <div className={`sync-panel sync-${sync.state}`}>
          <span className="sync-dot" />
          <div className="grow">
            <b>{sync.state === 'error' ? 'Sync problem' : 'Connected'}</b>
            <div className="muted small">
              {sync.state === 'error' ? sync.message
                : sync.state === 'saving' ? 'Saving changes…'
                : sync.state === 'loading' ? 'Loading from sheet…'
                : `Every change is saved to your sheet automatically · last sync ${ago(sync.at)}`}
            </div>
          </div>
        </div>
        <p className="muted small mt">Anyone in the family can open this app on their own device and connect with the same URL and secret key. Everyone shares one sheet, and the most recent save wins.</p>
        <div className="row gap wrap mt">
          <button className="btn btn-ghost" onClick={reloadFromSheet}>⟳ Reload from sheet</button>
          <button className="btn btn-ghost" onClick={saveToSheetNow}>⬆ Save now</button>
          <button className="btn btn-danger" onClick={() => confirm('Stop syncing on this device? Your data stays in the sheet and on this device.') && disconnectSheet()}>Disconnect</button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="☁️ Store data in Google Sheets" className="span-all">
      <p className="muted mb">Save everything to a Google Sheet you own. It works as a live backup and lets the whole family share the same data across phones and laptops. Setup takes about 3 minutes:</p>
      <ol className="steps">
        <li>Create a new <a href="https://sheets.new" target="_blank" rel="noreferrer">Google Sheet</a>, then open <b>Extensions → Apps Script</b>.</li>
        <li>
          Delete the sample code, paste in the sync script, and change <code>SECRET</code> to a long password of your own.
          <div className="mt"><button type="button" className="btn btn-sm" onClick={copyScript}>{copied ? '✓ Copied' : '📋 Copy sync script'}</button></div>
        </li>
        <li>Click <b>Deploy → New deployment</b>, choose type <b>Web app</b>, and set <i>Execute as</i>: <b>Me</b> and <i>Who has access</i>: <b>Anyone</b>. Click Deploy, allow access, then copy the <b>Web app URL</b>.</li>
        <li>Paste the URL and your secret below.</li>
      </ol>
      <form className="form-grid mt" onSubmit={test}>
        <Field label="Web app URL" span><input required value={url} placeholder="https://script.google.com/macros/s/…/exec" onChange={e => setUrl(e.target.value)} /></Field>
        <Field label="Secret key" span hint="The SECRET you set in the script"><input required type="password" value={token} onChange={e => setToken(e.target.value)} /></Field>
        {error && <div className="span-2 alert">{error}</div>}
        {found ? (
          <div className="span-2 choice">
            <b>This sheet already has data</b>
            <p className="muted small">{found.members.length} members · {found.incomes.length} incomes · {found.expenses.length} expenses · {found.emis.length} EMIs · {found.trips.length} trips</p>
            <div className="row gap wrap">
              <button type="button" className="btn" disabled={busy} onClick={() => choose('pull')}>⬇ Use sheet data on this device</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => choose('push')}>⬆ Replace sheet with this device's data</button>
            </div>
          </div>
        ) : (
          <div className="form-actions span-2">
            <span className="grow" />
            <button className="btn" disabled={busy}>{busy ? 'Connecting…' : 'Connect sheet'}</button>
          </div>
        )}
      </form>
      <p className="muted small mt">🔒 Your data goes straight from your browser to your own Google account. Keep the URL and secret private, because anyone who has both can read and edit the sheet.</p>
    </Card>
  )
}
