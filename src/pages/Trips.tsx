import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, NumInput, PageHeader, Progress, Stat } from '../components/ui'
import { MoneyTooltip } from './Dashboard'
import type { Trip, TripItem } from '../types'
import { CATEGORY_EMOJI, TRIP_CATEGORIES, dateLabel, daysUntil, fmt, monthsBetween, parseISO, pct, sumBy, todayISO, tripSettlement, uid, ymOf } from '../utils'

const EMOJIS = ['✈️', '🏝️', '⛰️', '🏰', '🏖️', '🗼', '🚗', '🛳️', '🏕️', '🎡', '🕌', '🌸']

export default function Trips() {
  const { data } = useStore()
  const sorted = [...data.trips].sort((a, b) => {
    const pa = daysUntil(a.endDate) < 0, pb = daysUntil(b.endDate) < 0
    return pa !== pb ? (pa ? 1 : -1) : pa ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)
  })
  const [selected, setSelected] = useState(sorted[0]?.id)
  const [form, setForm] = useState<Trip | null>(null)
  const trip = data.trips.find(t => t.id === selected) ?? sorted[0]
  const me = data.members.find(m => m.isSelf)?.name ?? 'Me'
  const blank = (): Trip => {
    const start = new Date(); start.setMonth(start.getMonth() + 1)
    const end = new Date(start); end.setDate(end.getDate() + 4)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return { id: '', name: '', destination: '', startDate: iso(start), endDate: iso(end), budget: 0, travelers: [me], emoji: '✈️', items: [], checklist: [] }
  }

  return (
    <div className="page">
      <PageHeader title="Trip Planner" subtitle="Budget it, track it, split it fairly"
        actions={<button className="btn" onClick={() => setForm(blank())}>+ Plan a trip</button>} />

      {sorted.length ? (
        <div className="trip-rail">
          {sorted.map(t => {
            const d = daysUntil(t.startDate), past = daysUntil(t.endDate) < 0
            const spent = sumBy(t.items, i => i.actual)
            return (
              <button key={t.id} className={`trip-tile ${trip?.id === t.id ? 'on' : ''} ${past ? 'past' : ''}`} onClick={() => setSelected(t.id)}>
                <span className="trip-emoji">{t.emoji}</span>
                <div className="grow">
                  <b>{t.name}</b>
                  <div className="muted small">{t.destination}</div>
                  <div className="small">{past ? 'Completed' : d > 0 ? `In ${d} days` : 'Happening now 🎉'} · {fmt(spent, { compact: true })}/{fmt(t.budget, { compact: true })}</div>
                </div>
              </button>
            )
          })}
        </div>
      ) : <Empty icon="✈️" title="Plan your first trip" text="Set a budget, list planned costs, log what you actually spend, and settle up with fellow travellers." action={<button className="btn" onClick={() => setForm(blank())}>Plan a trip</button>} />}

      {trip && <TripDetail trip={trip} onEdit={() => setForm(trip)} />}
      {form && <TripForm trip={form} onClose={() => setForm(null)} onSaved={setSelected} />}
    </div>
  )
}

function TripDetail({ trip, onEdit }: { trip: Trip; onEdit: () => void }) {
  const { update } = useStore()
  const [item, setItem] = useState<TripItem | null>(null)
  const [newTask, setNewTask] = useState('')
  const planned = sumBy(trip.items, i => i.planned)
  const spent = sumBy(trip.items, i => i.actual)
  const nights = Math.max(1, Math.round((parseISO(trip.endDate).getTime() - parseISO(trip.startDate).getTime()) / 86400000))
  const days = nights + 1
  const toGo = daysUntil(trip.startDate)
  const past = daysUntil(trip.endDate) < 0
  const s = tripSettlement(trip.travelers, trip.items)
  const monthsLeft = Math.max(1, monthsBetween(ymOf(todayISO()), ymOf(trip.startDate)))
  const remainingToFund = Math.max(0, Math.max(planned, trip.budget) - spent)
  const doneTasks = trip.checklist.filter(c => c.done).length

  const byCat = TRIP_CATEGORIES.map(c => ({
    name: c,
    planned: sumBy(trip.items.filter(i => i.category === c), i => i.planned),
    actual: sumBy(trip.items.filter(i => i.category === c), i => i.actual),
  })).filter(x => x.planned || x.actual)

  const mut = (fn: (t: Trip) => void) => update(d => { fn(d.trips.find(t => t.id === trip.id)!) })

  return (
    <>
      <div className="trip-hero card">
        <span className="trip-emoji big-emoji">{trip.emoji}</span>
        <div className="grow">
          <h2>{trip.name}</h2>
          <div className="muted">📍 {trip.destination} · {dateLabel(trip.startDate)} – {dateLabel(trip.endDate)} · {days} days / {nights} nights</div>
          <div className="muted small">👥 {trip.travelers.join(', ')}</div>
        </div>
        <div className="countdown">
          {past ? <><b>✓</b><span>completed</span></> : toGo > 0 ? <><b>{toGo}</b><span>days to go</span></> : <><b>🎉</b><span>on the trip!</span></>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit trip</button>
      </div>

      <div className="grid stats-4">
        <Stat icon="🎯" label="Budget" value={fmt(trip.budget)} sub={`${fmt(trip.budget / days)}/day · ${fmt(trip.budget / Math.max(1, trip.travelers.length))}/person`} />
        <Stat icon="📝" label="Planned" value={fmt(planned)} tone={planned > trip.budget ? 'bad' : undefined}
          sub={planned > trip.budget ? `${fmt(planned - trip.budget)} over budget` : `${fmt(trip.budget - planned)} buffer`} />
        <Stat icon="💸" label="Spent so far" value={fmt(spent)} sub={`${pct(trip.budget ? spent / trip.budget * 100 : 0)} of budget`} />
        <Stat icon="🐷" label={past ? 'Final vs budget' : 'Save per month'} tone={past ? (spent <= trip.budget ? 'good' : 'bad') : 'accent'}
          value={past ? fmt(trip.budget - spent) : fmt(remainingToFund / monthsLeft)}
          sub={past ? (spent <= trip.budget ? 'under budget 🎉' : 'over budget') : `${fmt(remainingToFund)} still to fund over ${monthsLeft} mo`} />
      </div>

      <Card title="Budget progress">
        <div className="budget-track">
          <Progress value={spent} max={trip.budget} />
          <div className="row-between small muted mt"><span>Spent {fmt(spent)}</span><span>Planned {fmt(planned)}</span><span>Budget {fmt(trip.budget)}</span></div>
        </div>
      </Card>

      <div className="grid cols-3-1">
        <Card title="Expenses" action={<button className="btn btn-sm" onClick={() => setItem({ id: '', category: 'Stay', title: '', planned: 0, actual: 0, paidBy: trip.travelers[0] })}>+ Add item</button>}>
          {trip.items.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Item</th><th>Paid by</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Diff</th></tr></thead>
                <tbody>
                  {trip.items.map(i => {
                    const diff = i.actual ? i.planned - i.actual : 0
                    return (
                      <tr key={i.id} className="clickable" onClick={() => setItem(i)}>
                        <td>{CATEGORY_EMOJI[i.category] ?? '🧳'} {i.title}<div className="muted small">{i.category}</div></td>
                        <td>{i.actual ? i.paidBy ?? '—' : <span className="muted">not booked</span>}</td>
                        <td className="num">{fmt(i.planned)}</td>
                        <td className="num"><b>{i.actual ? fmt(i.actual) : '—'}</b></td>
                        <td className={`num ${diff > 0 ? 'text-good' : diff < 0 ? 'text-bad' : 'muted'}`}>{diff ? (diff > 0 ? '−' : '+') + fmt(Math.abs(diff)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot><tr><td colSpan={2}>Total</td><td className="num">{fmt(planned)}</td><td className="num"><b>{fmt(spent)}</b></td><td /></tr></tfoot>
              </table>
            </div>
          ) : <Empty icon="🧳" title="No items yet" text="Add flights, stays, food and activities with planned costs." />}
        </Card>

        <Card title={`✅ Checklist · ${doneTasks}/${trip.checklist.length}`}>
          <ul className="checklist">
            {trip.checklist.map(c => (
              <li key={c.id}>
                <label className={c.done ? 'done' : ''}>
                  <input type="checkbox" checked={c.done} onChange={() => mut(t => { const x = t.checklist.find(x => x.id === c.id)!; x.done = !x.done })} />
                  {c.text}
                </label>
                <button className="icon-btn" aria-label="Remove" onClick={() => mut(t => { t.checklist = t.checklist.filter(x => x.id !== c.id) })}>✕</button>
              </li>
            ))}
          </ul>
          <form className="row gap mt" onSubmit={e => { e.preventDefault(); if (newTask.trim()) { mut(t => { t.checklist.push({ id: uid(), text: newTask.trim(), done: false }) }); setNewTask('') } }}>
            <input className="grow" placeholder="Add a to-do…" value={newTask} onChange={e => setNewTask(e.target.value)} />
            <button className="btn btn-sm">Add</button>
          </form>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Planned vs actual by category">
          {byCat.length ? (
            <ResponsiveContainer width="100%" height={Math.max(160, byCat.length * 44)}>
              <BarChart data={byCat} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmt(v, { compact: true })} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="planned" name="Planned" fill="var(--c-planned)" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="actual" name="Actual" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty icon="📊" title="Add items to see the breakdown" />}
        </Card>

        <Card title="🤝 Split & settle up">
          {trip.travelers.length > 1 ? (
            <>
              <div className="kv"><span>Total spent</span><b>{fmt(s.total)}</b></div>
              <div className="kv"><span>Fair share each ({trip.travelers.length})</span><b>{fmt(s.share)}</b></div>
              <hr />
              {s.balances.map(b => (
                <div key={b.name} className="kv">
                  <span>{b.name} <span className="muted small">paid {fmt(b.paid)}</span></span>
                  <b className={b.balance > 0.5 ? 'text-good' : b.balance < -0.5 ? 'text-bad' : 'muted'}>
                    {b.balance > 0.5 ? `gets ${fmt(b.balance)}` : b.balance < -0.5 ? `owes ${fmt(-b.balance)}` : 'settled'}
                  </b>
                </div>
              ))}
              {s.transfers.length > 0 && (
                <div className="owed-box">
                  <div className="small muted mb">Suggested transfers</div>
                  {s.transfers.map((t, i) => <div key={i} className="transfer"><b>{t.from}</b> → <b>{t.to}</b><span className="grow" /><b>{fmt(t.amount)}</b></div>)}
                </div>
              )}
            </>
          ) : <Empty icon="👥" title="Solo trip" text="Add more travellers to split costs." />}
        </Card>
      </div>

      {trip.notes && <Card title="📝 Notes"><p className="pre">{trip.notes}</p></Card>}

      {item && <TripItemForm item={item} travelers={trip.travelers} onClose={() => setItem(null)}
        onSave={it => mut(t => { if (it.id) t.items = t.items.map(x => x.id === it.id ? it : x); else t.items.push({ ...it, id: uid() }) })}
        onDelete={id => mut(t => { t.items = t.items.filter(x => x.id !== id) })} />}
    </>
  )
}

function TripItemForm({ item, travelers, onClose, onSave, onDelete }: {
  item: TripItem; travelers: string[]; onClose: () => void; onSave: (i: TripItem) => void; onDelete: (id: string) => void
}) {
  const [f, setF] = useState(item)
  return (
    <Modal open title={f.id ? 'Edit trip item' : 'Add trip item'} onClose={onClose}>
      <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(f); onClose() }}>
        <Field label="Item" span><input required autoFocus value={f.title} placeholder="Hotel, flight, scuba dive…" onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Category">
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{TRIP_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Paid by">
          <select value={f.paidBy ?? ''} onChange={e => setF({ ...f, paidBy: e.target.value || undefined })}>
            <option value="">—</option>
            {travelers.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Planned cost"><NumInput min={0} value={f.planned} placeholder="0" onChange={v => setF({ ...f, planned: v })} /></Field>
        <Field label="Actual spent" hint="Leave 0 until booked/paid"><NumInput min={0} value={f.actual} placeholder="0" onChange={v => setF({ ...f, actual: v })} /></Field>
        <div className="form-actions span-2">
          {f.id && <button type="button" className="btn btn-danger" onClick={() => { onDelete(f.id); onClose() }}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function TripForm({ trip, onClose, onSaved }: { trip: Trip; onClose: () => void; onSaved: (id: string) => void }) {
  const { data, update } = useStore()
  const [f, setF] = useState(trip)
  const [travelers, setTravelers] = useState(trip.travelers.join(', '))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const t = { ...f, travelers: travelers.split(',').map(s => s.trim()).filter(Boolean) }
    if (t.endDate < t.startDate) return alert('End date is before start date')
    const id = t.id || uid()
    update(d => {
      if (t.id) d.trips = d.trips.map(x => x.id === t.id ? t : x)
      else d.trips.push({
        ...t, id, checklist: [
          { id: uid(), text: 'Book transport', done: false },
          { id: uid(), text: 'Book stay', done: false },
          { id: uid(), text: 'Check ID / passport', done: false },
        ],
      })
    })
    onSaved(id); onClose()
  }
  const addTraveler = (name: string) => {
    const list = travelers.split(',').map(s => s.trim()).filter(Boolean)
    if (!list.includes(name)) setTravelers([...list, name].join(', '))
  }
  return (
    <Modal open wide title={f.id ? 'Edit trip' : 'Plan a new trip'} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <Field label="Trip name"><input required autoFocus value={f.name} placeholder="Goa with friends" onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Destination"><input required value={f.destination} placeholder="Goa, India" onChange={e => setF({ ...f, destination: e.target.value })} /></Field>
        <Field label="Start"><input type="date" required value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="End"><input type="date" required value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Total budget"><NumInput required min={0} value={f.budget} placeholder="0" onChange={v => setF({ ...f, budget: v })} /></Field>
        <Field label="Icon">
          <div className="emoji-pick">{EMOJIS.map(e => <button type="button" key={e} className={f.emoji === e ? 'on' : ''} onClick={() => setF({ ...f, emoji: e })}>{e}</button>)}</div>
        </Field>
        <Field label="Travellers (comma separated)" span><input value={travelers} onChange={e => setTravelers(e.target.value)} /></Field>
        <div className="span-2 row gap wrap">
          {data.members.map(m => <button type="button" key={m.id} className="chip" onClick={() => addTraveler(m.name)}>+ {m.name}</button>)}
        </div>
        <Field label="Notes" span><textarea rows={3} value={f.notes ?? ''} placeholder="Ideas, links, booking refs…" onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="form-actions span-2">
          {f.id && <button type="button" className="btn btn-danger" onClick={() => { if (confirm('Delete this trip?')) { update(d => { d.trips = d.trips.filter(x => x.id !== f.id) }); onClose() } }}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}
