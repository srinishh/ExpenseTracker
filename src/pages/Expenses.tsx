import { useState } from 'react'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, NumInput, PageHeader, Progress, Stat } from '../components/ui'
import type { Bucket, Emi, Expense, PaymentMethod } from '../types'
import { BucketPicker } from './Split'
import { FAMILY, MemberSpending } from '../components/MemberSpending'
import { EmiForm } from './CreditCards'
import {
  BUCKETS, BUCKET_LABEL, CATEGORY_EMOJI, EXPENSE_CATEGORIES, addMonths, bucketOf, emiExpenseRows, emiStatus, getAllocation, currentYM, dateLabel, daysUntil, dueDate, expensesInMonth, isMonthly, isPaid, fmt, groupSum, monthLabel, sumBy, todayISO, uid,
} from '../utils'

export const METHOD_LABEL: Record<PaymentMethod, string> = { upi: '📱 UPI', cash: '💵 Cash', card: '💳 Card', bank: '🏦 Bank' }

export default function Expenses() {
  const { data, update } = useStore()
  const [ym, setYm] = useState(currentYM())
  const [cat, setCat] = useState('')
  const [bucket, setBucket] = useState<Bucket | ''>('')
  const [q, setQ] = useState('')
  const [member, setMember] = useState('') // '' = everyone, FAMILY = untagged, else a member id
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [editingEmi, setEditingEmi] = useState<Emi | null>(null)

  const { map } = getAllocation(data)
  const emiRows = emiExpenseRows(data, ym)
  const all = [...expensesInMonth(data.expenses, ym), ...emiRows]
  const open = (e: Expense) => {
    if (!e.emiId) return setEditing(e)
    const emi = data.emis.find(x => x.id === e.emiId)
    if (emi) setEditingEmi(emi)
  }
  const bucketTotal = (b: Bucket) => sumBy(all.filter(e => bucketOf(e, map) === b), e => e.amount)
  const known = new Set(data.members.map(m => m.id))
  // The per-member chart follows every filter except "who", so all members stay comparable
  const filtered = all
    .filter(e => !bucket || bucketOf(e, map) === bucket)
    .filter(e => !cat || e.category === cat)
    .filter(e => !q || e.description.toLowerCase().includes(q.toLowerCase()))
  const list = filtered
    .filter(e => !member || (member === FAMILY ? !e.memberId || !known.has(e.memberId) : e.memberId === member))
    .filter(e => !unpaidOnly || !isPaid(e, ym))
    .sort((a, b) => (b.recurring ? 0 : 1) - (a.recurring ? 0 : 1) || b.date.localeCompare(a.date))
  const total = sumBy(all, e => e.amount)
  const byMethod = groupSum(all, e => e.method, e => e.amount)
  const days = ym === currentYM() ? Number(todayISO().slice(8)) : new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()
  const cardName = (id?: string) => { const c = data.cards.find(c => c.id === id); return c ? `${c.bank} ${c.name}` : '' }
  const memberName = (id?: string) => data.members.find(m => m.id === id)?.name
  const pastMonth = ym < currentYM()
  const togglePaid = (e: Expense) => update(d => {
    const flip = (months: string[] = []) => months.includes(ym) ? months.filter(m => m !== ym) : [...months, ym]
    if (e.emiId) {
      const emi = d.emis.find(x => x.id === e.emiId)
      if (emi) emi.paidMonths = flip(emi.paidMonths)
      return
    }
    const x = d.expenses.find(x => x.id === e.id)
    if (!x) return
    if (x.recurring) x.paidMonths = flip(x.paidMonths)
    else if (x.paid === false) delete x.paid
    else x.paid = false
  })
  const paidBox = (e: Expense) => {
    const locked = pastMonth && isMonthly(e)
    return (
      <label className="paid-box" onClick={ev => ev.stopPropagation()} title={locked ? 'Past months count as paid' : isPaid(e, ym) ? 'Paid. Untick if it still needs paying' : 'Tick when paid'}>
        <input type="checkbox" checked={isPaid(e, ym)} disabled={locked} onChange={() => togglePaid(e)} aria-label={`Paid: ${e.description}`} />
      </label>
    )
  }
  const emiShared = (id: string) => {
    const emi = data.emis.find(x => x.id === id)
    return emi?.shares.length ? ` · your share of ${fmt(emiStatus(emi).monthly)}` : ''
  }

  return (
    <div className="page">
      <PageHeader title="Expenses" subtitle="Every rupee, every family member"
        actions={<>
          <div className="month-picker">
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Previous month">‹</button>
            <span>{monthLabel(ym, true)}</span>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Next month">›</button>
          </div>
          <button className="btn btn-ghost" onClick={() => setEditingEmi(newEmi(data.cards[0]?.id))}>+ Add EMI</button>
          <button className="btn" onClick={() => setEditing(newExpense())}>+ Add expense</button>
        </>} />

      <div className="grid stats-4">
        <Stat icon="🧾" label="Total outflow" value={fmt(total)} sub={`${all.length} entries · ${fmt(sumBy(emiRows, e => e.amount), { compact: true })} EMIs · ${fmt(bucketTotal('invest'), { compact: true })} invested`} />
        <Stat icon="📅" label="Daily average" value={fmt(total / Math.max(1, days))} />
        <Stat icon="💳" label="On cards" value={fmt(byMethod.card ?? 0)} sub={`${Math.round(((byMethod.card ?? 0) / (total || 1)) * 100)}% of spend`} />
        <Stat icon="🔁" label="Recurring" value={fmt(sumBy(all.filter(e => e.recurring), e => e.amount))} sub="fixed monthly costs" />
      </div>

      <ToPay rows={all} ym={ym} paidBox={paidBox} onShowAll={() => { setUnpaidOnly(true); setMember(''); setBucket(''); setCat(''); setQ('') }} />

      <Card title="👥 Spending by family member" action={member && <button className="link" onClick={() => setMember('')}>Show everyone</button>}>
        <p className="muted small mb">Each person's top categories this month{bucket || cat || q ? ' (matching your filters below)' : ''}. Tap a person to see only their expenses.</p>
        <MemberSpending rows={filtered} members={data.members} map={map} selected={member} onSelect={setMember} />
      </Card>

      <Card>
        <div className="seg bucket-filter mb">
          <button className={!bucket ? 'on' : ''} onClick={() => setBucket('')}>All · {fmt(total, { compact: true })}</button>
          {BUCKETS.map(b => (
            <button key={b.id} className={bucket === b.id ? `on b-${b.id}` : ''} onClick={() => setBucket(b.id)}>
              {b.icon} {b.label} · {fmt(bucketTotal(b.id), { compact: true })}
            </button>
          ))}
        </div>
        <div className="filters">
          <input placeholder="🔍 Search expenses…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={member} onChange={e => setMember(e.target.value)} aria-label="Who">
            <option value="">Everyone</option>
            {data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={FAMILY}>Whole family (shared)</option>
          </select>
          <label className="check unpaid-toggle"><input type="checkbox" checked={unpaidOnly} onChange={e => setUnpaidOnly(e.target.checked)} /> Unpaid only</label>
        </div>
        {list.length ? (
          <ul className="tx-list">
            {list.map(e => (
              <li key={e.id} className={`tx ${isPaid(e, ym) ? '' : 'unpaid'}`} onClick={() => open(e)}>
                {paidBox(e)}
                <span className="tx-icon">{CATEGORY_EMOJI[e.category] ?? '📦'}</span>
                <div className="grow">
                  <div>{e.description}<span className={`pill pill-${bucketOf(e, map)}`}>{BUCKET_LABEL[bucketOf(e, map)]}</span>{e.recurring && <span className="pill">monthly</span>}{e.emiId && <span className="pill pill-emi">{e.cardId ? 'Card EMI' : 'Loan EMI'} {e.instalment}</span>}{e.cardId && !e.billed && <span className="pill pill-warn">unbilled</span>}{!isPaid(e, ym) && <DuePill date={dueDate(e, ym)} />}</div>
                  <div className="muted small">
                    {e.recurring ? 'Every month' : dateLabel(e.date)} · {e.category} · {METHOD_LABEL[e.method]}{e.cardId && ` ${cardName(e.cardId)}`}
                    {memberName(e.memberId) && ` · for ${memberName(e.memberId)}`}
                    {e.emiId && emiShared(e.emiId)}
                  </div>
                </div>
                <b>{fmt(e.amount)}</b>
              </li>
            ))}
          </ul>
        ) : unpaidOnly
          ? <Empty icon="🎉" title="Nothing left to pay" text="Everything matching these filters is paid." />
          : <Empty icon="🧾" title="No expenses here" text="Add one, or change the month / filters." />}
      </Card>

      {editingEmi && <EmiForm emi={editingEmi} onClose={() => setEditingEmi(null)} />}
      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)}
        onDelete={id => update(d => { d.expenses = d.expenses.filter(x => x.id !== id) })} />}
    </div>
  )
}

function DuePill({ date }: { date: string }) {
  const d = daysUntil(date)
  if (d < 0) return <span className="pill pill-overdue">overdue {-d}d</span>
  return <span className="pill pill-due">{d === 0 ? 'due today' : `due in ${d}d`}</span>
}

/** What this month still needs paying: overdue first, then by due date. */
function ToPay({ rows, ym, paidBox, onShowAll }: {
  rows: Expense[]; ym: string; paidBox: (e: Expense) => React.ReactNode; onShowAll: () => void
}) {
  const total = sumBy(rows, e => e.amount)
  const unpaid = rows.filter(e => !isPaid(e, ym)).sort((a, b) => dueDate(a, ym).localeCompare(dueDate(b, ym)))
  const left = sumBy(unpaid, e => e.amount)
  const overdue = unpaid.filter(e => daysUntil(dueDate(e, ym)) < 0)
  const shown = unpaid.slice(0, 6)
  return (
    <Card title={`✅ To pay · ${monthLabel(ym, true)}`}
      action={unpaid.length > shown.length && <button className="link" onClick={onShowAll}>See all {unpaid.length} →</button>}>
      <div className="topay-stats">
        <div><span className="muted small">Still to pay</span><b className={left ? 'big' : 'big text-good'}>{fmt(left)}</b><span className="muted small">{unpaid.length} item{unpaid.length === 1 ? '' : 's'}</span></div>
        <div><span className="muted small">Overdue</span><b className={`big ${overdue.length ? 'text-bad' : ''}`}>{fmt(sumBy(overdue, e => e.amount))}</b><span className="muted small">{overdue.length} item{overdue.length === 1 ? '' : 's'}</span></div>
        <div className="grow">
          <div className="row-between small"><span className="muted">Paid</span><span>{fmt(total - left)} of {fmt(total)}</span></div>
          <Progress value={total - left} max={total || 1} tone="good" />
        </div>
      </div>
      {shown.length ? (
        <ul className="tx-list mt">
          {shown.map(e => (
            <li key={e.id} className="tx unpaid">
              {paidBox(e)}
              <span className="tx-icon">{CATEGORY_EMOJI[e.category] ?? '📦'}</span>
              <div className="grow">
                <div>{e.description}<DuePill date={dueDate(e, ym)} /></div>
                <div className="muted small">{dateLabel(dueDate(e, ym))} · {e.emiId ? (e.cardId ? 'Card EMI' : 'Loan EMI') : e.recurring ? 'Monthly' : e.category}</div>
              </div>
              <b>{fmt(e.amount)}</b>
            </li>
          ))}
        </ul>
      ) : <p className="muted mt">🎉 Everything for {monthLabel(ym, true)} is paid.</p>}
      <p className="muted small mt">Tick the box when you pay. Monthly bills and EMIs reset each month, and one-off expenses count as paid unless you untick them.</p>
    </Card>
  )
}

export function newEmi(cardId?: string): Emi {
  return { id: '', title: '', principal: 0, rate: 0, tenure: 12, startDate: todayISO(), shares: [], settlements: {}, cardId }
}

export function newExpense(extra: Partial<Expense> = {}): Expense {
  return { id: '', description: '', category: 'Food & Dining', amount: 0, date: todayISO(), method: 'upi', memberId: 'self', ...extra }
}

export function ExpenseForm({ expense, onClose, onDelete, title }: {
  expense: Expense; onClose: () => void; onDelete?: (id: string) => void; title?: string
}) {
  const { data, update } = useStore()
  const [f, setF] = useState(expense)
  const autoBucket = getAllocation(data).map[f.category] ?? 'wants'
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const clean: Expense = { ...f }
    if (!clean.bucket) delete clean.bucket
    if (clean.paid !== false || clean.recurring) delete clean.paid
    if (clean.method !== 'card') { delete clean.cardId; delete clean.billed }
    else { clean.cardId = clean.cardId ?? data.cards[0]?.id; clean.billed = clean.billed ?? false }
    update(d => {
      if (clean.id) d.expenses = d.expenses.map(x => x.id === clean.id ? clean : x)
      else d.expenses.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={title ?? (f.id ? 'Edit expense' : 'Add expense')} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <Field label="Description" span><input required autoFocus value={f.description} placeholder="What was it for?" onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Amount"><NumInput required min={0} value={f.amount} placeholder="0" onChange={v => setF({ ...f, amount: v })} /></Field>
        <Field label="Date"><input type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Category">
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="For">
          <select value={f.memberId ?? ''} onChange={e => setF({ ...f, memberId: e.target.value || undefined })}>
            <option value="">Whole family</option>
            {data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Paid via">
          <select value={f.method} onChange={e => setF({ ...f, method: e.target.value as PaymentMethod })}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {f.method === 'card' && (
          <Field label="Card">
            {data.cards.length ? (
              <select value={f.cardId ?? data.cards[0].id} onChange={e => setF({ ...f, cardId: e.target.value })}>
                {data.cards.map(c => <option key={c.id} value={c.id}>{c.bank} {c.name} ••{c.last4}</option>)}
              </select>
            ) : <span className="muted small">Add a card in Credit Cards first</span>}
          </Field>
        )}
        <Field group label="Bucket" span hint={f.bucket ? 'Overridden for this expense only' : `Auto: follows the ${f.category} category`}>
          <div className="row gap wrap">
            <BucketPicker value={f.bucket ?? autoBucket} onChange={b => setF({ ...f, bucket: b === autoBucket ? undefined : b })} />
            {f.bucket && <button type="button" className="link" onClick={() => setF({ ...f, bucket: undefined })}>Use category default</button>}
          </div>
        </Field>
        {!f.recurring && (
          <label className="check span-2">
            <input type="checkbox" checked={f.paid !== false} onChange={e => setF({ ...f, paid: e.target.checked ? undefined : false })} />
            Already paid (untick to track it in "To pay")
          </label>
        )}
        <label className="check span-2">
          <input type="checkbox" checked={!!f.recurring} onChange={e => setF({ ...f, recurring: e.target.checked })} />
          Repeats every month (rent, subscriptions, insurance…)
        </label>
        {f.method === 'card' && (
          <label className="check span-2">
            <input type="checkbox" checked={!f.billed} onChange={e => setF({ ...f, billed: !e.target.checked })} />
            Still unbilled (not yet on a statement)
          </label>
        )}
        <div className="form-actions span-2">
          {f.id && onDelete && <button type="button" className="btn btn-danger" onClick={() => { if (confirm('Delete this expense?')) { onDelete(f.id); onClose() } }}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}
