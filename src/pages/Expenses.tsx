import { useState } from 'react'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, NumInput, PageHeader, Stat } from '../components/ui'
import type { Expense, PaymentMethod } from '../types'
import {
  CATEGORY_EMOJI, EXPENSE_CATEGORIES, addMonths, currentYM, dateLabel, expensesInMonth, fmt, groupSum, monthLabel, sumBy, todayISO, uid,
} from '../utils'

export const METHOD_LABEL: Record<PaymentMethod, string> = { upi: '📱 UPI', cash: '💵 Cash', card: '💳 Card', bank: '🏦 Bank' }

export default function Expenses() {
  const { data, update } = useStore()
  const [ym, setYm] = useState(currentYM())
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Expense | null>(null)

  const all = expensesInMonth(data.expenses, ym)
  const list = all
    .filter(e => !cat || e.category === cat)
    .filter(e => !q || e.description.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.recurring ? 0 : 1) - (a.recurring ? 0 : 1) || b.date.localeCompare(a.date))
  const total = sumBy(all, e => e.amount)
  const byMethod = groupSum(all, e => e.method, e => e.amount)
  const days = ym === currentYM() ? Number(todayISO().slice(8)) : new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()
  const cardName = (id?: string) => { const c = data.cards.find(c => c.id === id); return c ? `${c.bank} ${c.name}` : '' }
  const memberName = (id?: string) => data.members.find(m => m.id === id)?.name

  return (
    <div className="page">
      <PageHeader title="Expenses" subtitle="Every rupee, every family member"
        actions={<>
          <div className="month-picker">
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Previous month">‹</button>
            <span>{monthLabel(ym, true)}</span>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Next month">›</button>
          </div>
          <button className="btn" onClick={() => setEditing(newExpense())}>+ Add expense</button>
        </>} />

      <div className="grid stats-4">
        <Stat icon="🧾" label="Total spent" value={fmt(total)} sub={`${all.length} transactions`} />
        <Stat icon="📅" label="Daily average" value={fmt(total / Math.max(1, days))} />
        <Stat icon="💳" label="On cards" value={fmt(byMethod.card ?? 0)} sub={`${Math.round(((byMethod.card ?? 0) / (total || 1)) * 100)}% of spend`} />
        <Stat icon="🔁" label="Recurring" value={fmt(sumBy(all.filter(e => e.recurring), e => e.amount))} sub="fixed monthly costs" />
      </div>

      <Card>
        <div className="filters">
          <input placeholder="🔍 Search expenses…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {list.length ? (
          <ul className="tx-list">
            {list.map(e => (
              <li key={e.id} className="tx" onClick={() => setEditing(e)}>
                <span className="tx-icon">{CATEGORY_EMOJI[e.category] ?? '📦'}</span>
                <div className="grow">
                  <div>{e.description}{e.recurring && <span className="pill">monthly</span>}{e.cardId && !e.billed && <span className="pill pill-warn">unbilled</span>}</div>
                  <div className="muted small">
                    {e.recurring ? 'Every month' : dateLabel(e.date)} · {e.category} · {METHOD_LABEL[e.method]}{e.cardId && ` ${cardName(e.cardId)}`}
                    {memberName(e.memberId) && ` · for ${memberName(e.memberId)}`}
                  </div>
                </div>
                <b>{fmt(e.amount)}</b>
              </li>
            ))}
          </ul>
        ) : <Empty icon="🧾" title="No expenses here" text="Add one, or change the month / filters." />}
      </Card>

      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)}
        onDelete={id => update(d => { d.expenses = d.expenses.filter(x => x.id !== id) })} />}
    </div>
  )
}

export function newExpense(extra: Partial<Expense> = {}): Expense {
  return { id: '', description: '', category: 'Food & Dining', amount: 0, date: todayISO(), method: 'upi', memberId: 'self', ...extra }
}

export function ExpenseForm({ expense, onClose, onDelete, title }: {
  expense: Expense; onClose: () => void; onDelete?: (id: string) => void; title?: string
}) {
  const { data, update } = useStore()
  const [f, setF] = useState(expense)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const clean: Expense = { ...f }
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
