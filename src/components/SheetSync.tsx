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
  if (!sheet) {
    return (
      <a href="#/settings" className="sync-badge sync-off" title="This device isn't connected to Google Sheets, so its data stays on this device only">
        <span className="sync-dot" /><span>Not synced</span>
      </a>
    )
  }
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

const CONNECT_HASH = /^#\/connect\?(.*)$/

/** Link that connects another device in one tap. The secret rides in the #fragment, which browsers never send to a server. */
export function deviceLink(url: string, token: string) {
  const q = new URLSearchParams({ u: url, k: token })
  return `${window.location.origin}${window.location.pathname}#/connect?${q}`
}

/** True when this device holds nothing worth keeping, so sheet data can replace it without asking. */
function isThrowaway(d: AppData) {
  return d.isSample || (!d.expenses.length && !d.incomes.length && !d.cards.length && !d.emis.length && !d.trips.length)
}

function DeviceLink({ url, token }: { url: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const link = deviceLink(url, token)
  useEffect(() => {
    if (!open) return
    let live = true
    import('qrcode').then(QR => QR.toDataURL(link, { margin: 1, width: 240 })).then(d => { if (live) setQr(d) }).catch(() => setQr(''))
    return () => { live = false }
  }, [open, link])
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>📱 Connect another device</button>
  return (
    <div className="device-link span-all">
      {qr && <img src={qr} alt="QR code that connects another device to this Google Sheet" width={180} height={180} />}
      <div className="grow">
        <b>Connect a phone or another laptop</b>
        <ol className="steps mt">
          <li>Scan this code with the phone camera, or send the link to that device.</li>
          <li>It opens the app and connects to this sheet automatically.</li>
        </ol>
        <div className="row gap wrap mt">
          <button className="btn btn-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { prompt('Copy this link', link) }
          }}>{copied ? '✓ Link copied' : '🔗 Copy link'}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Hide</button>
        </div>
        <p className="muted small mt">🔒 The link contains your secret key. Only share it with family, for example in a private chat.</p>
      </div>
    </div>
  )
}

export function SheetSettings() {
  const { data, sheet, sync, connectSheet, disconnectSheet, reloadFromSheet, saveToSheetNow } = useStore()
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

  const test = async (u = url, k = token) => {
    setError(''); setFound(null)
    if (!isValidScriptUrl(u)) return setError('The URL should look like https://script.google.com/macros/s/…/exec')
    setBusy(true)
    try {
      const remote = await pullFromSheet({ url: u.trim(), token: k })
      const hasData = remote && (remote.members?.length || remote.expenses?.length || remote.incomes?.length)
      if (!hasData) await connectSheet({ url: u, token: k }, 'push')
      else if (isThrowaway(data)) await connectSheet({ url: u, token: k }, 'pull') // nothing here to lose
      else setFound(remote)
    } catch (err) {
      setError((err as Error).message === 'Failed to fetch'
        ? 'Could not reach the script. Check the URL and that access is set to "Anyone".'
        : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Opened from a "Connect another device" link
  useEffect(() => {
    const m = window.location.hash.match(CONNECT_HASH)
    if (!m) return
    const q = new URLSearchParams(m[1])
    const u = q.get('u') ?? '', k = q.get('k') ?? ''
    history.replaceState(null, '', '#/settings') // keep the secret out of the address bar and history
    if (sheet || !u || !k) return
    setUrl(u); setToken(k)
    test(u, k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <p className="muted small mt">Each device connects separately. Use <b>Connect another device</b> to link a phone in one scan. Everyone shares one sheet, and the most recent save wins.</p>
        <div className="row gap wrap mt">
          <button className="btn btn-ghost" onClick={reloadFromSheet}>⟳ Reload from sheet</button>
          <button className="btn btn-ghost" onClick={saveToSheetNow}>⬆ Save now</button>
          <DeviceLink url={sheet.url} token={sheet.token} />
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
      <form className="form-grid mt" onSubmit={e => { e.preventDefault(); test() }}>
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
