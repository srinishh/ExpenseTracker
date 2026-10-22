import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { Avatar, Card, Empty, Field, Modal, NumInput, PageHeader, Progress, Stat, Tabs } from '../components/ui'
import { MoneyTooltip } from './Dashboard'
import type { Income, Member } from '../types'
import {
  INCOME_CATEGORIES, PALETTE, currentYM, dateLabel, fmt, incomeInMonth, lastNMonths, monthLabel, pct, sumBy, todayISO, uid,
} from '../utils'

export default function FamilyIncome() {
  const { data } = useStore()
  const [tab, setTab] = useState<string>('all')
  const [memberModal, setMemberModal] = useState<Member | null>(null)
  const [incomeModal, setIncomeModal] = useState<Income | null>(null)

  const ym = currentYM()
  const months = lastNMonths(12)
  const familyThisMonth = incomeInMonth(data.incomes, ym)
  const member = data.members.find(m => m.id === tab)

  const newIncome = (memberId: string): Income => ({
    id: '', memberId, source: '', category: 'Salary', amount: 0, date: todayISO(), recurring: true,
  })

  return (
    <div className="page">
      <PageHeader title="Family Income" subtitle="Every earner gets their own tab"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setMemberModal({ id: '', name: '', relation: '', color: PALETTE[data.members.length % PALETTE.length] })}>+ Member</button>
          <button className="btn" onClick={() => setIncomeModal(newIncome(member?.id ?? data.members[0]?.id))}>+ Add income</button>
        </>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'all', label: '👨‍👩‍👧 All family' },
        ...data.members.map(m => ({ id: m.id, label: <><Avatar name={m.name} color={m.color} size={20} /> {m.name}</> })),
      ]} />

      {tab === 'all' && (
        <>
          <div className="grid stats-4">
            <Stat icon="💵" label="This month" value={fmt(familyThisMonth)} tone="good" />
            <Stat icon="📆" label="Last 12 months" value={fmt(sumBy(months, m => incomeInMonth(data.incomes, m)))} />
            <Stat icon="📊" label="Monthly average" value={fmt(sumBy(months, m => incomeInMonth(data.incomes, m)) / 12)} />
            <Stat icon="👥" label="Earning members" value={data.members.filter(m => incomeInMonth(data.incomes, ym, m.id) > 0).length} sub={`of ${data.members.length} members`} />
          </div>
          <Card title="Income by member · 12 months">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={months.map(m => ({ label: monthLabel(m), ...Object.fromEntries(data.members.map(mem => [mem.id, incomeInMonth(data.incomes, m, mem.id)])) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v, { compact: true })} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {data.members.map((m, i) => (
                  <Bar key={m.id} dataKey={m.id} name={m.name} stackId="a" fill={m.color} maxBarSize={32}
                    radius={i === data.members.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid cols-2">
            {data.members.map(m => {
              const now = incomeInMonth(data.incomes, ym, m.id)
              return (
                <button key={m.id} className="card member-card" onClick={() => setTab(m.id)}>
                  <Avatar name={m.name} color={m.color} size={44} />
                  <div className="grow">
                    <div className="row-between"><b>{m.name}</b><b>{fmt(now)}</b></div>
                    <div className="muted small mb">{m.relation} · {familyThisMonth ? pct(now / familyThisMonth * 100) : '0%'} of family income</div>
                    <Progress value={now} max={familyThisMonth} tone="accent" thin />
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {member && <MemberView member={member} onEditMember={() => setMemberModal(member)}
        onAdd={() => setIncomeModal(newIncome(member.id))} onEdit={setIncomeModal} />}

      {memberModal && <MemberForm member={memberModal} onClose={() => setMemberModal(null)} onDeleted={() => setTab('all')} />}
      {incomeModal && <IncomeForm income={incomeModal} onClose={() => setIncomeModal(null)} />}

      {!data.members.length && <Empty icon="👨‍👩‍👧" title="Add your first family member" />}
    </div>
  )
}

function MemberView({ member, onEditMember, onAdd, onEdit }: {
  member: Member; onEditMember: () => void; onAdd: () => void; onEdit: (i: Income) => void
}) {
  const { data, update } = useStore()
  const ym = currentYM()
  const months = lastNMonths(12)
  const series = months.map(m => ({ label: monthLabel(m), income: incomeInMonth(data.incomes, m, member.id) }))
  const total12 = sumBy(series, s => s.income)
  const incomes = data.incomes.filter(i => i.memberId === member.id).sort((a, b) => b.date.localeCompare(a.date))
  const recurring = incomes.filter(i => i.recurring)
  const family = incomeInMonth(data.incomes, ym)
  const now = incomeInMonth(data.incomes, ym, member.id)

  return (
    <>
      <div className="member-hero card">
        <Avatar name={member.name} color={member.color} size={56} />
        <div className="grow">
          <h2>{member.name}</h2>
          <div className="muted">{member.relation}{member.isSelf && ' · you'}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onEditMember}>Edit member</button>
        <button className="btn btn-sm" onClick={onAdd}>+ Income</button>
      </div>

      <div className="grid stats-4">
        <Stat icon="💵" label="This month" value={fmt(now)} tone="good" />
        <Stat icon="🔁" label="Recurring monthly" value={fmt(sumBy(recurring, i => i.amount))} sub={`${recurring.length} source${recurring.length === 1 ? '' : 's'}`} />
        <Stat icon="📆" label="Last 12 months" value={fmt(total12)} sub={`avg ${fmt(total12 / 12)}/mo`} />
        <Stat icon="🥧" label="Share of family" value={family ? pct(now / family * 100) : '—'} />
      </div>

      <div className="grid cols-3-1">
        <Card title="Monthly income">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v, { compact: true })} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
              <Bar dataKey="income" name="Income" fill={member.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="By source">
          {INCOME_CATEGORIES.map(c => ({ c, v: sumBy(incomes.filter(i => i.category === c), i => i.recurring ? i.amount : 0) + sumBy(incomes.filter(i => i.category === c && !i.recurring && months.includes(i.date.slice(0, 7))), i => i.amount) }))
            .filter(x => x.v > 0).map(x => (
              <div key={x.c} className="row-between list-row"><span>{x.c}</span><b>{fmt(x.v)}</b></div>
            ))}
          {!incomes.length && <p className="muted">No income yet.</p>}
        </Card>
      </div>

      <Card title="Income entries">
        {incomes.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Source</th><th>Category</th><th>Date</th><th>Type</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {incomes.map(i => (
                  <tr key={i.id}>
                    <td>{i.source}</td>
                    <td><span className="pill">{i.category}</span></td>
                    <td>{i.recurring ? `Since ${monthLabel(i.date.slice(0, 7))}` : dateLabel(i.date)}</td>
                    <td>{i.recurring ? '🔁 Monthly' : 'One-time'}</td>
                    <td className="num"><b>{fmt(i.amount)}</b></td>
                    <td className="actions">
                      <button className="icon-btn" onClick={() => onEdit(i)} aria-label="Edit">✎</button>
                      <button className="icon-btn" aria-label="Delete" onClick={() => confirm('Delete this income?') && update(d => { d.incomes = d.incomes.filter(x => x.id !== i.id) })}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon="💵" title={`No income for ${member.name} yet`} action={<button className="btn btn-sm" onClick={onAdd}>Add income</button>} />}
      </Card>
    </>
  )
}

function MemberForm({ member, onClose, onDeleted }: { member: Member; onClose: () => void; onDeleted: () => void }) {
  const { update } = useStore()
  const [f, setF] = useState(member)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    update(d => {
      if (f.id) d.members = d.members.map(m => m.id === f.id ? f : m)
      else d.members.push({ ...f, id: uid() })
    })
    onClose()
  }
  const remove = () => {
    if (!confirm(`Remove ${f.name}? Their income entries will be deleted too.`)) return
    update(d => {
      d.members = d.members.filter(m => m.id !== f.id)
      d.incomes = d.incomes.filter(i => i.memberId !== f.id)
      for (const e of d.emis) e.shares = e.shares.filter(s => s.memberId !== f.id)
    })
    onDeleted(); onClose()
  }
  return (
    <Modal open title={f.id ? 'Edit member' : 'Add family member'} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <Field label="Name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Relation"><input value={f.relation} placeholder="Spouse, Father…" onChange={e => setF({ ...f, relation: e.target.value })} /></Field>
        <Field label="Colour" span>
          <div className="swatches">
            {PALETTE.map(c => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />)}
          </div>
        </Field>
        <div className="form-actions span-2">
          {f.id && !f.isSelf && <button type="button" className="btn btn-danger" onClick={remove}>Remove</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function IncomeForm({ income, onClose }: { income: Income; onClose: () => void }) {
  const { data, update } = useStore()
  const [f, setF] = useState(income)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    update(d => {
      if (f.id) d.incomes = d.incomes.map(i => i.id === f.id ? f : i)
      else d.incomes.push({ ...f, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={f.id ? 'Edit income' : 'Add income'} onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <Field label="Member">
          <select value={f.memberId} onChange={e => setF({ ...f, memberId: e.target.value })}>
            {data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Source" span><input required value={f.source} placeholder="Employer, tenant, client…" onChange={e => setF({ ...f, source: e.target.value })} autoFocus /></Field>
        <Field label="Amount"><NumInput required min={0} value={f.amount} placeholder="0" onChange={v => setF({ ...f, amount: v })} /></Field>
        <Field label={f.recurring ? 'Starts from' : 'Date'}><input type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <label className="check span-2">
          <input type="checkbox" checked={f.recurring} onChange={e => setF({ ...f, recurring: e.target.checked })} />
          Recurring every month (salary, rent, pension…)
        </label>
        <div className="form-actions span-2">
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}
