import { useRef } from 'react'
import { useStore } from '../store'
import { emptyData, sampleData } from '../sample'
import { Card, Field, PageHeader } from '../components/ui'
import { CURRENCIES, todayISO } from '../utils'
import type { AppData } from '../types'
import { SheetSettings } from '../components/SheetSync'

export default function Settings() {
  const { data, update, replace } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportJSON = () => download(`family-finance-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')

  const exportCSV = () => {
    const name = (id?: string) => data.members.find(m => m.id === id)?.name ?? ''
    const card = (id?: string) => { const c = data.cards.find(c => c.id === id); return c ? `${c.bank} ${c.name}` : '' }
    const rows = [
      ['Type', 'Date', 'Description', 'Category', 'Member', 'Method', 'Card', 'Recurring', 'Amount'],
      ...data.incomes.map(i => ['Income', i.date, i.source, i.category, name(i.memberId), '', '', i.recurring ? 'yes' : '', i.amount]),
      ...data.expenses.map(e => ['Expense', e.date, e.description, e.category, name(e.memberId), e.method, card(e.cardId), e.recurring ? 'yes' : '', -e.amount]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    download(`transactions-${todayISO()}.csv`, csv, 'text/csv')
  }

  const importJSON = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      if (!Array.isArray(parsed.members)) throw new Error('bad file')
      if (confirm('Replace all current data with this backup?')) replace(parsed)
    } catch {
      alert('That file does not look like a Family Finance backup.')
    }
  }

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Preferences, backups and data" />
      <div className="grid cols-2">
        <SheetSettings />
        <Card title="Preferences">
          <div className="form-grid">
            <Field label="Currency">
              <select value={data.settings.currency} onChange={e => update(d => { d.settings.currency = e.target.value })}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Theme">
              <select value={data.settings.theme} onChange={e => update(d => { d.settings.theme = e.target.value as AppData['settings']['theme'] })}>
                <option value="system">Match system</option>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Backup & export">
          <p className="muted small mb">Without Google Sheets sync, your data lives only in this browser. Download a backup regularly, or to move it to another device.</p>
          <div className="row gap wrap">
            <button className="btn" onClick={exportJSON}>⬇ Download backup (JSON)</button>
            <button className="btn btn-ghost" onClick={exportCSV}>⬇ Transactions CSV</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>⬆ Restore backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = '' }} />
          </div>
        </Card>

        <Card title="Data">
          <div className="row gap wrap">
            <button className="btn btn-ghost" onClick={() => confirm('Load sample data? This replaces your current data.') && replace(sampleData())}>Load sample data</button>
            <button className="btn btn-danger" onClick={() => confirm('Erase everything? This cannot be undone.') && replace({ ...emptyData(), settings: data.settings })}>Erase all data</button>
          </div>
        </Card>

        <Card title="About">
          <p className="muted small">
            {data.members.length} members · {data.incomes.length} income entries · {data.expenses.length} expenses ·{' '}
            {data.cards.length} cards · {data.emis.length} EMIs · {data.trips.length} trips
          </p>
          <p className="muted small">Data is stored in this browser, and in your own Google Sheet if you connect one. There's no third-party server.</p>
        </Card>
      </div>
    </div>
  )
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}
