import { useState } from 'react'
import { useStore } from '../store'
import { Avatar, Card, Empty, Field, Modal, NumInput, PageHeader, Progress, Stat, Tabs } from '../components/ui'
import { ExpenseForm, newExpense } from './Expenses'
import type { CreditCard, Emi, EmiShare } from '../types'
import {
  EMI_CATEGORY, EXPENSE_CATEGORIES, CATEGORY_EMOJI, addMonths, cardStatus, currentYM, dateLabel, daysUntil, emiMonthly, emiStatus, fmt, monthLabel, pct,
  shareLedger, sumBy, todayISO, uid, ymOf,
} from '../utils'

type Sub = 'cards' | 'emis' | 'shared'

const CARD_COLORS = ['#1e3a8a', '#7e22ce', '#b45309', '#0f766e', '#be123c', '#334155', '#15803d', '#0369a1']

export default function CreditCards() {
  const { data } = useStore()
  const [sub, setSub] = useState<Sub>('cards')
  const sharedCount = data.emis.filter(e => e.shares.length).length
  const allSt = data.cards.map(c => cardStatus(c, data))
  const emiSt = data.emis.map(e => emiStatus(e))

  return (
    <div className="page">
      <PageHeader title="Credit Cards & EMIs" subtitle="Unbilled spends, EMIs, and EMIs shared with family" />
      <div className="grid stats-4">
        <Stat icon="🧾" label="Total unbilled" value={fmt(sumBy(allSt, s => s.unbilled))} />
        <Stat icon="📬" label="Bills to pay" value={fmt(sumBy(data.cards, c => c.billedOutstanding))} tone={sumBy(data.cards, c => c.billedOutstanding) ? 'warn' : undefined} />
        <Stat icon="🏦" label="Monthly EMIs" value={fmt(sumBy(emiSt.filter(s => s.remaining > 0), s => s.monthly))} sub={`your share ${fmt(sumBy(emiSt.filter(s => s.remaining > 0), s => s.yourMonthly))}`} />
        <Stat icon="💰" label="Available credit" value={fmt(sumBy(allSt, s => s.available))} tone="good" sub={`of ${fmt(sumBy(data.cards, c => c.limit))}`} />
      </div>
      <Tabs active={sub} onChange={setSub} tabs={[
        { id: 'cards', label: `💳 Cards & unbilled` },
        { id: 'emis', label: `🏦 EMIs (${data.emis.length})` },
        { id: 'shared', label: `🤝 Shared with family (${sharedCount})` },
      ]} />
      {sub === 'cards' && <CardsView />}
      {sub === 'emis' && <EmisView />}
      {sub === 'shared' && <SharedView />}
    </div>
  )
}

// ---------------- Cards & unbilled ----------------

function CardsView() {
  const { data, update } = useStore()
  const [selected, setSelected] = useState(data.cards[0]?.id)
  const [cardForm, setCardForm] = useState<CreditCard | null>(null)
  const [adding, setAdding] = useState(false)
  const card = data.cards.find(c => c.id === selected) ?? data.cards[0]
  const st = card && cardStatus(card, data)

  const blank: CreditCard = { id: '', name: '', bank: '', last4: '', limit: 0, billingDay: 15, dueDay: 5, color: CARD_COLORS[data.cards.length % CARD_COLORS.length], billedOutstanding: 0 }

  const generateStatement = () => {
    if (!card || !st) return
    if (!confirm(`Move ${fmt(st.unbilled)} of unbilled spends to the statement and add this month's EMIs (${fmt(st.emiMonthlyTotal)})?`)) return
    update(d => {
      for (const e of d.expenses) if (e.cardId === card.id && !e.billed) e.billed = true
      const c = d.cards.find(c => c.id === card.id)!
      c.billedOutstanding += st.unbilled + st.emiMonthlyTotal
    })
  }

  return (
    <>
      <div className="card-rail">
        {data.cards.map(c => {
          const s = cardStatus(c, data)
          return (
            <button key={c.id} className={`cc ${card?.id === c.id ? 'on' : ''}`} style={{ '--cc': c.color } as React.CSSProperties} onClick={() => setSelected(c.id)}>
              <div className="cc-top"><span className="cc-bank">{c.bank}</span><span className="cc-chip" /></div>
              <div className="cc-name">{c.name}</div>
              <div className="cc-num">•••• •••• •••• {c.last4 || '0000'}</div>
              <div className="cc-bottom">
                <div><div className="cc-k">Available</div><div className="cc-v">{fmt(s.available, { compact: true })}</div></div>
                <div><div className="cc-k">Unbilled</div><div className="cc-v">{fmt(s.unbilled, { compact: true })}</div></div>
                <div><div className="cc-k">Used</div><div className="cc-v">{pct(s.utilization)}</div></div>
              </div>
            </button>
          )
        })}
        <button className="cc cc-add" onClick={() => setCardForm(blank)}><span>＋</span>Add card</button>
      </div>

      {card && st ? (
        <div className="grid cols-3-1">
          <Card title={<>🧾 Unbilled on {card.bank} {card.name}</>}
            action={<div className="row gap">
              <button className="btn btn-ghost btn-sm" onClick={generateStatement} disabled={!st.unbilled && !st.emiMonthlyTotal}>Generate statement</button>
              <button className="btn btn-sm" onClick={() => setAdding(true)}>+ Unbilled spend</button>
            </div>}>
            {st.unbilledItems.length ? (
              <ul className="tx-list">
                {[...st.unbilledItems].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                  <li key={e.id} className="tx">
                    <span className="tx-icon">{CATEGORY_EMOJI[e.category] ?? '📦'}</span>
                    <div className="grow"><div>{e.description}</div><div className="muted small">{dateLabel(e.date)} · {e.category}</div></div>
                    <b>{fmt(e.amount)}</b>
                    <button className="icon-btn" aria-label="Delete" onClick={() => confirm('Delete this spend?') && update(d => { d.expenses = d.expenses.filter(x => x.id !== e.id) })}>🗑</button>
                  </li>
                ))}
                <li className="tx total"><span className="grow">Unbilled total</span><b>{fmt(st.unbilled)}</b></li>
              </ul>
            ) : <Empty icon="✨" title="No unbilled spends" text="Card spends you add here also count in your expenses." />}
          </Card>

          <Card title="Card details" action={<button className="link" onClick={() => setCardForm(card)}>Edit</button>}>
            <div className="kv"><span>Credit limit</span><b>{fmt(card.limit)}</b></div>
            <div className="kv"><span>Unbilled</span><b>{fmt(st.unbilled)}</b></div>
            <div className="kv"><span>Statement due</span><b>{fmt(card.billedOutstanding)}</b></div>
            <div className="kv"><span>Blocked by EMIs</span><b>{fmt(st.emiBlocked)}</b></div>
            <div className="kv"><span>Available</span><b className="text-good">{fmt(st.available)}</b></div>
            <Progress value={st.used} max={card.limit} />
            <div className="muted small mt">{pct(st.utilization)} utilization {st.utilization > 30 ? '· try to stay under 30%' : '· healthy'}</div>
            <hr />
            <div className="kv"><span>Next statement</span><b>{dateLabel(st.nextStatement)}</b></div>
            <div className="kv"><span>Payment due</span><b className={daysUntil(st.nextDue) <= 5 && card.billedOutstanding ? 'text-bad' : ''}>{dateLabel(st.nextDue)} ({daysUntil(st.nextDue)}d)</b></div>
            <div className="kv"><span>EMIs on card</span><b>{st.cardEmis.filter(x => x.st.remaining > 0).length} · {fmt(st.emiMonthlyTotal)}/mo</b></div>
            {card.billedOutstanding > 0 && (
              <button className="btn btn-sm full mt" onClick={() => confirm(`Mark ${fmt(card.billedOutstanding)} bill as paid?`) && update(d => { d.cards.find(c => c.id === card.id)!.billedOutstanding = 0 })}>
                ✓ Mark bill as paid
              </button>
            )}
          </Card>
        </div>
      ) : <Empty icon="💳" title="Add your first credit card" text="Track limits, unbilled spends, statement & due dates." action={<button className="btn" onClick={() => setCardForm(blank)}>Add card</button>} />}

      {cardForm && <CardForm card={cardForm} onClose={() => setCardForm(null)} onSaved={id => setSelected(id)} />}
      {adding && card && <ExpenseForm title={`Unbilled spend · ${card.bank} ${card.name}`} expense={newExpense({ method: 'card', cardId: card.id, billed: false, category: 'Shopping' })} onClose={() => setAdding(false)} />}
    </>
  )
}

function CardForm({ card, onClose, onSaved }: { card: CreditCard; onClose: () => void; onSaved: (id: string) => void }) {
  const { update } = useStore()
  const [f, setF] = useState(card)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const id = f.id || uid()
    update(d => {
      if (f.id) d.cards = d.cards.map(c => c.id === f.id ? f : c)
      else d.cards.push({ ...f, id })
    })
    onSaved(id); onClose()
  }
  const remove = () => {
    if (!confirm('Delete this card? Its spends stay in expenses; EMIs become plain loans.')) return
    update(d => {
      d.cards = d.cards.filter(c => c.id !== f.id)
      for (const e of d.expenses) if (e.cardId === f.id) { delete e.cardId; e.method = 'bank'; delete e.billed }
      for (const e of d.emis) if (e.cardId === f.id) delete e.cardId
    })
    onClose()
  }
  return (
    <Modal open title={f.id ? 'Edit card' : 'Add credit card'} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <Field label="Bank"><input required autoFocus value={f.bank} placeholder="HDFC, SBI…" onChange={e => setF({ ...f, bank: e.target.value })} /></Field>
        <Field label="Card name"><input required value={f.name} placeholder="Regalia, Millennia…" onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Last 4 digits"><input maxLength={4} inputMode="numeric" value={f.last4} onChange={e => setF({ ...f, last4: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Credit limit"><NumInput required min={0} value={f.limit} placeholder="0" onChange={v => setF({ ...f, limit: v })} /></Field>
        <Field label="Statement day" hint="Day of month the bill is generated"><NumInput min={1} max={31} required value={f.billingDay} onChange={v => setF({ ...f, billingDay: v })} /></Field>
        <Field label="Due day" hint="Day of month payment is due"><NumInput min={1} max={31} required value={f.dueDay} onChange={v => setF({ ...f, dueDay: v })} /></Field>
        <Field label="Current statement outstanding" span hint="Amount already billed and still to be paid"><NumInput min={0} value={f.billedOutstanding} placeholder="0" onChange={v => setF({ ...f, billedOutstanding: v })} /></Field>
        <Field group label="Colour" span>
          <div className="swatches">{CARD_COLORS.map(c => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />)}</div>
        </Field>
        <div className="form-actions span-2">
          {f.id && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------- EMIs ----------------

function EmisView() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Emi | null>(null)
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const items = data.emis.map(e => ({ emi: e, st: emiStatus(e) }))
    .filter(x => filter === 'all' || (filter === 'active' ? x.st.remaining > 0 : x.st.remaining === 0))
    .sort((a, b) => a.st.remaining - b.st.remaining)
  const blank: Emi = { id: '', title: '', principal: 0, rate: 0, tenure: 12, startDate: todayISO(), shares: [], settlements: {}, cardId: data.cards[0]?.id }
  const cardName = (id?: string) => { const c = data.cards.find(c => c.id === id); return c ? `💳 ${c.bank} ${c.name}` : '🏦 Loan' }
  const memberName = (id: string) => data.members.find(m => m.id === id)?.name ?? '?'

  return (
    <>
      <div className="row-between mb">
        <div className="seg">
          {(['active', 'done', 'all'] as const).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'done' ? 'Completed' : f[0].toUpperCase() + f.slice(1)}</button>)}
        </div>
        <button className="btn" onClick={() => setEditing(blank)}>+ Add EMI</button>
      </div>
      {items.length ? (
        <div className="grid cols-2">
          {items.map(({ emi, st }) => (
            <section key={emi.id} className="card emi-card" onClick={() => setEditing(emi)}>
              <div className="row-between">
                <div>
                  <h3>{emi.title}</h3>
                  <div className="muted small">{cardName(emi.cardId)} · {emi.rate ? `${emi.rate}% p.a.` : 'No-cost'} · {emi.tenure} months</div>
                </div>
                <div className="right">
                  <div className="big">{fmt(st.monthly)}</div>
                  <div className="muted small">per month</div>
                </div>
              </div>
              <Progress value={st.paid} max={emi.tenure} tone={st.remaining ? 'accent' : 'good'} />
              <div className="row-between small">
                <span>{st.paid} of {emi.tenure} paid</span>
                <span className="muted">{monthLabel(st.startYM)} → {monthLabel(st.endYM)}</span>
              </div>
              <div className="emi-grid">
                <div><span>Principal</span><b>{fmt(emi.principal)}</b></div>
                <div><span>Outstanding</span><b>{fmt(st.outstanding)}</b></div>
                <div><span>Total interest</span><b>{fmt(st.totalInterest)}</b></div>
                <div><span>Months left</span><b>{st.remaining}</b></div>
              </div>
              {emi.shares.length > 0 && (
                <div className="share-strip">
                  🤝 Shared: {emi.shares.map(s => `${memberName(s.memberId)} ${s.percent}%`).join(', ')} · you pay {fmt(st.yourMonthly)}/mo
                </div>
              )}
              {st.nextDueDate && <div className="muted small">Next instalment: {dateLabel(st.nextDueDate)}</div>}
            </section>
          ))}
        </div>
      ) : <Empty icon="🏦" title={filter === 'done' ? 'No completed EMIs yet' : 'No EMIs here'} text="Add card EMIs or loans with tenure, rate and start date." action={<button className="btn" onClick={() => setEditing(blank)}>Add EMI</button>} />}
      {editing && <EmiForm emi={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function EmiForm({ emi, onClose }: { emi: Emi; onClose: () => void }) {
  const { data, update } = useStore()
  const [f, setF] = useState(emi)
  const monthly = emiMonthly(f.principal, f.rate, f.tenure)
  const others = data.members.filter(m => !m.isSelf)
  const sharedPct = sumBy(f.shares, s => s.percent)
  const setShare = (i: number, s: Partial<EmiShare>) => setF({ ...f, shares: f.shares.map((x, k) => k === i ? { ...x, ...s } : x) })

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (sharedPct > 100) return alert('Shares add up to more than 100%')
    const clean = { ...f, shares: f.shares.filter(s => s.memberId && s.percent > 0) }
    update(d => {
      if (clean.id) d.emis = d.emis.map(x => x.id === clean.id ? clean : x)
      else d.emis.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open wide title={f.id ? 'Edit EMI' : 'Add EMI'} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <Field label="What is it for?" span><input required autoFocus value={f.title} placeholder="iPhone, Home loan, Laptop…" onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Paid via">
          <select value={f.cardId ?? ''} onChange={e => setF({ ...f, cardId: e.target.value || undefined })}>
            <option value="">🏦 Bank loan / other</option>
            {data.cards.map(c => <option key={c.id} value={c.id}>💳 {c.bank} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Category" hint="Shown in expense charts">
          <select value={f.category ?? EMI_CATEGORY} onChange={e => setF({ ...f, category: e.target.value === EMI_CATEGORY ? undefined : e.target.value })}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="For">
          <select value={f.memberId ?? data.members.find(m => m.isSelf)?.id ?? ''} onChange={e => setF({ ...f, memberId: e.target.value })}>
            {data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Amount financed"><NumInput required min={1} value={f.principal} placeholder="0" onChange={v => setF({ ...f, principal: v })} /></Field>
        <Field label="Interest rate (% p.a.)" hint="0 for no-cost EMI"><NumInput min={0} step="0.01" value={f.rate} onChange={v => setF({ ...f, rate: v })} /></Field>
        <Field label="Duration (months)">
          <NumInput required min={1} max={480} value={f.tenure} onChange={v => setF({ ...f, tenure: Math.round(v) })} />
        </Field>
        <Field label="First instalment date"><input type="date" required value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="Processing fee"><NumInput min={0} value={f.processingFee ?? 0} placeholder="0" onChange={v => setF({ ...f, processingFee: v })} /></Field>
        <div className="quick-tenure span-2">
          {[3, 6, 9, 12, 18, 24, 36, 60].map(n => <button type="button" key={n} className={`chip ${f.tenure === n ? 'on' : ''}`} onClick={() => setF({ ...f, tenure: n })}>{n}m</button>)}
        </div>

        <div className="calc span-2">
          <div><span>Monthly EMI</span><b>{fmt(monthly)}</b></div>
          <div><span>Total interest</span><b>{fmt(monthly * f.tenure - f.principal)}</b></div>
          <div><span>Total payable</span><b>{fmt(monthly * f.tenure + (f.processingFee ?? 0))}</b></div>
          <div><span>Ends</span><b>{f.startDate ? monthLabel(addMonths(ymOf(f.startDate), f.tenure - 1), true) : '—'}</b></div>
        </div>

        <div className="span-2">
          <div className="row-between mb">
            <b>🤝 Share with family</b>
            {others.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, shares: [...f.shares, { memberId: others.find(o => !f.shares.some(s => s.memberId === o.id))?.id ?? others[0].id, percent: 50 }] })}>+ Add person</button>}
          </div>
          {!others.length && <p className="muted small">Add family members in Family Income to share EMIs.</p>}
          {f.shares.map((s, i) => (
            <div key={i} className="share-row">
              <select value={s.memberId} onChange={e => setShare(i, { memberId: e.target.value })}>
                {others.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <NumInput min={0} max={100} value={s.percent} onChange={v => setShare(i, { percent: v })} />
              <span className="muted">%</span>
              <span className="grow right">{fmt(monthly * s.percent / 100)}/mo</span>
              <button type="button" className="icon-btn" onClick={() => setF({ ...f, shares: f.shares.filter((_, k) => k !== i) })} aria-label="Remove">✕</button>
            </div>
          ))}
          {f.shares.length > 0 && <div className={`small ${sharedPct > 100 ? 'text-bad' : 'muted'}`}>You pay {100 - sharedPct}% · {fmt(monthly * (100 - sharedPct) / 100)}/mo</div>}
        </div>

        <div className="form-actions span-2">
          {f.id && <button type="button" className="btn btn-danger" onClick={() => { if (confirm('Delete this EMI?')) { update(d => { d.emis = d.emis.filter(x => x.id !== f.id) }); onClose() } }}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------- Shared EMIs ----------------

function SharedView() {
  const { data, update } = useStore()
  const shared = data.emis.filter(e => e.shares.length)
  const member = (id: string) => data.members.find(m => m.id === id)
  const ledgers = shared.flatMap(e => shareLedger(e).map(l => ({ ...l, emi: e })))
  const byMember = data.members.filter(m => ledgers.some(l => l.memberId === m.id)).map(m => {
    const ls = ledgers.filter(l => l.memberId === m.id)
    return { m, pending: sumBy(ls, l => l.pendingAmount), monthly: sumBy(ls.filter(l => l.remainingFuture > 0), l => l.perMonth), future: sumBy(ls, l => l.remainingFuture) }
  })

  const toggle = (emiId: string, ym: string, memberId: string) => update(d => {
    const e = d.emis.find(x => x.id === emiId)!
    const list = e.settlements[ym] ?? []
    e.settlements[ym] = list.includes(memberId) ? list.filter(x => x !== memberId) : [...list, memberId]
  })
  const settleAll = (emi: Emi, memberId: string) => update(d => {
    const e = d.emis.find(x => x.id === emi.id)!
    const st = emiStatus(e)
    for (let i = 0; i < st.paid; i++) {
      const ym = addMonths(st.startYM, i)
      const list = e.settlements[ym] ?? []
      if (!list.includes(memberId)) e.settlements[ym] = [...list, memberId]
    }
  })

  if (!shared.length) return <Empty icon="🤝" title="No shared EMIs yet" text="When adding or editing an EMI, use “Share with family” to split it. Then track who has paid you back each month here." />

  return (
    <>
      <div className="grid cols-3">
        {byMember.map(({ m, pending, monthly, future }) => (
          <div key={m.id} className="card member-card static">
            <Avatar name={m.name} color={m.color} size={44} />
            <div className="grow">
              <b>{m.name}</b>
              <div className={pending > 0 ? 'text-bad' : 'text-good'}>{pending > 0 ? `Owes you ${fmt(pending)}` : 'All settled ✓'}</div>
              <div className="muted small">{fmt(monthly)}/mo · {fmt(future)} still to come</div>
            </div>
          </div>
        ))}
      </div>

      {shared.map(emi => {
        const st = emiStatus(emi)
        const ledger = shareLedger(emi)
        const nowYM = currentYM()
        const months = Array.from({ length: Math.min(emi.tenure, st.paid + (st.remaining > 0 ? 1 : 0)) }, (_, i) => addMonths(st.startYM, i)).reverse()
        return (
          <Card key={emi.id} title={<>{emi.title} <span className="muted small">· {fmt(st.monthly)}/mo · {st.paid}/{emi.tenure} paid</span></>}>
            <div className="grid cols-auto">
              {ledger.map(l => {
                const m = member(l.memberId)
                return (
                  <div key={l.memberId} className="ledger">
                    <div className="row gap"><Avatar name={m?.name ?? '?'} color={m?.color ?? '#888'} size={28} /><b>{m?.name}</b><span className="pill">{l.percent}%</span></div>
                    <div className="kv"><span>Per month</span><b>{fmt(l.perMonth)}</b></div>
                    <div className="kv"><span>Paid back</span><b className="text-good">{fmt(l.settledAmount)} ({l.settledMonths}m)</b></div>
                    <div className="kv"><span>Pending</span><b className={l.pendingAmount > 0 ? 'text-bad' : ''}>{fmt(l.pendingAmount)} ({l.pendingMonths}m)</b></div>
                    <div className="kv"><span>Future</span><b>{fmt(l.remainingFuture)}</b></div>
                    {l.pendingMonths > 0 && <button className="btn btn-sm btn-ghost full" onClick={() => settleAll(emi, l.memberId)}>Mark all settled</button>}
                  </div>
                )
              })}
              <div className="ledger you">
                <div className="row gap"><Avatar name="Me" color="var(--accent)" size={28} /><b>Your share</b><span className="pill">{100 - st.sharedPct}%</span></div>
                <div className="kv"><span>Per month</span><b>{fmt(st.yourMonthly)}</b></div>
                <div className="kv"><span>Months left</span><b>{st.remaining}</b></div>
              </div>
            </div>
            <div className="table-wrap settle-table">
              <table className="table">
                <thead><tr><th>Month</th>{ledger.map(l => <th key={l.memberId} className="center">{member(l.memberId)?.name}</th>)}</tr></thead>
                <tbody>
                  {months.map(ym => (
                    <tr key={ym} className={ym > nowYM || (ym === nowYM && st.nextDueYM === ym) ? 'upcoming' : ''}>
                      <td>{monthLabel(ym, true)}{st.nextDueYM === ym && <span className="pill pill-warn">upcoming</span>}</td>
                      {ledger.map(l => {
                        const on = emi.settlements[ym]?.includes(l.memberId)
                        return (
                          <td key={l.memberId} className="center">
                            <button className={`settle ${on ? 'on' : ''}`} onClick={() => toggle(emi.id, ym, l.memberId)}>
                              {on ? '✓ Paid' : fmt(l.perMonth)}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </>
  )
}
