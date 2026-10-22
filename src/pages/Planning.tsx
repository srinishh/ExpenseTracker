import { useState } from 'react'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, NumInput, PageHeader, Progress, Stat } from '../components/ui'
import type { Goal } from '../types'
import { CATEGORY_EMOJI, addMonths, EXPENSE_CATEGORIES, currentYM, daysUntil, expensesInMonth, fmt, lastNMonths, monthsBetween, pct, sumBy, todayISO, uid, ymOf } from '../utils'

const GOAL_EMOJI = ['🛟', '🏡', '🚗', '🎓', '💍', '🏝️', '👶', '📱', '💻', '🧓', '🎸', '💰']

export default function Planning() {
  const { data, update } = useStore()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [deposit, setDeposit] = useState<Goal | null>(null)
  const ym = currentYM()
  const monthExp = expensesInMonth(data.expenses, ym)
  const spentIn = (cat: string, m = ym) => sumBy(expensesInMonth(data.expenses, m).filter(e => e.category === cat), e => e.amount)
  const avg3 = (cat: string) => sumBy(lastNMonths(3, addMonths(ym, -1)), m => spentIn(cat, m)) / 3
  const totalBudget = sumBy(Object.values(data.budgets), v => v)
  const budgetedSpend = sumBy(monthExp.filter(e => data.budgets[e.category]), e => e.amount)
  const dayOfMonth = Number(todayISO().slice(8))
  const daysInMonth = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()

  const setBudget = (cat: string, v: number) => update(d => { if (v > 0) d.budgets[cat] = v; else delete d.budgets[cat] })

  return (
    <div className="page">
      <PageHeader title="Budgets & Goals" subtitle="Spend with intention, save with purpose"
        actions={<button className="btn" onClick={() => setGoal({ id: '', name: '', target: 0, saved: 0, emoji: '💰' })}>+ New goal</button>} />

      <div className="grid stats-4">
        <Stat icon="🎯" label="Monthly budget" value={fmt(totalBudget)} sub={`${Object.keys(data.budgets).length} categories`} />
        <Stat icon="🧾" label="Spent in budgeted" value={fmt(budgetedSpend)} tone={budgetedSpend > totalBudget ? 'bad' : undefined} sub={totalBudget ? `${pct(budgetedSpend / totalBudget * 100)} used` : ''} />
        <Stat icon="⏳" label="Month elapsed" value={pct(dayOfMonth / daysInMonth * 100)} sub={`${daysInMonth - dayOfMonth} days left`} />
        <Stat icon="🐷" label="Saved in goals" value={fmt(sumBy(data.goals, g => g.saved))} tone="accent" sub={`of ${fmt(sumBy(data.goals, g => g.target))}`} />
      </div>

      <Card title="Savings goals">
        {data.goals.length ? (
          <div className="grid cols-3">
            {data.goals.map(g => {
              const left = Math.max(0, g.target - g.saved)
              const months = g.deadline ? Math.max(1, monthsBetween(ym, ymOf(g.deadline))) : 0
              return (
                <div key={g.id} className="goal">
                  <div className="row-between">
                    <span className="goal-emoji">{g.emoji}</span>
                    <button className="link" onClick={() => setGoal(g)}>Edit</button>
                  </div>
                  <b>{g.name}</b>
                  <div className="big">{fmt(g.saved)} <span className="muted small">/ {fmt(g.target)}</span></div>
                  <Progress value={g.saved} max={g.target} tone={g.saved >= g.target ? 'good' : 'accent'} />
                  <div className="muted small">
                    {left === 0 ? '🎉 Goal reached!' : g.deadline
                      ? `${fmt(left / months)}/mo for ${months} mo${daysUntil(g.deadline) < 0 ? ' (deadline passed)' : ''}`
                      : `${fmt(left)} to go`}
                  </div>
                  <button className="btn btn-sm btn-ghost full" onClick={() => setDeposit(g)}>+ Add money</button>
                </div>
              )
            })}
          </div>
        ) : <Empty icon="🐷" title="No goals yet" text="Emergency fund, a house, a car — give your savings a purpose." />}
      </Card>

      <Card title={`Category budgets · ${new Date().toLocaleDateString('en-US', { month: 'long' })}`}>
        <p className="muted small mb">Set a monthly limit per category. The pace marker shows where you'd be if you spent evenly through the month.</p>
        <div className="budget-list">
          {EXPENSE_CATEGORIES.map(cat => {
            const b = data.budgets[cat] ?? 0
            const spent = spentIn(cat)
            const projected = dayOfMonth ? spent / dayOfMonth * daysInMonth : spent
            const avg = avg3(cat)
            return (
              <div key={cat} className={`budget-row ${b ? '' : 'unset'}`}>
                <span className="tx-icon">{CATEGORY_EMOJI[cat]}</span>
                <div className="grow">
                  <div className="row-between">
                    <span>{cat}</span>
                    <span className="small"><b>{fmt(spent)}</b>{b > 0 && <span className="muted"> / {fmt(b)}</span>}</span>
                  </div>
                  {b > 0 ? (
                    <>
                      <div className="pace-wrap">
                        <Progress value={spent} max={b} thin />
                        <span className="pace" style={{ left: `${Math.min(100, dayOfMonth / daysInMonth * 100)}%` }} />
                      </div>
                      <div className={`small ${projected > b ? 'text-bad' : 'muted'}`}>
                        {spent > b ? `Over by ${fmt(spent - b)}` : `${fmt(b - spent)} left`}
                        {projected > b && spent <= b && ` · on pace for ${fmt(projected)}`}
                      </div>
                    </>
                  ) : <div className="muted small">3-month avg {fmt(avg)}</div>}
                </div>
                <NumInput className="budget-input" min={0} value={b} placeholder="Set" onChange={v => setBudget(cat, v)} aria-label={`${cat} budget`} />
              </div>
            )
          })}
        </div>
      </Card>

      {goal && <GoalForm goal={goal} onClose={() => setGoal(null)} />}
      {deposit && <DepositForm goal={deposit} onClose={() => setDeposit(null)} />}
    </div>
  )
}

function GoalForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useStore()
  const [f, setF] = useState(goal)
  return (
    <Modal open title={f.id ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      <form className="form-grid" onSubmit={e => {
        e.preventDefault()
        update(d => { if (f.id) d.goals = d.goals.map(g => g.id === f.id ? f : g); else d.goals.push({ ...f, id: uid() }) })
        onClose()
      }}>
        <Field label="Goal" span><input required autoFocus value={f.name} placeholder="Emergency fund" onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Target"><NumInput required min={1} value={f.target} placeholder="0" onChange={v => setF({ ...f, target: v })} /></Field>
        <Field label="Already saved"><NumInput min={0} value={f.saved} placeholder="0" onChange={v => setF({ ...f, saved: v })} /></Field>
        <Field label="Target date (optional)"><input type="date" value={f.deadline ?? ''} onChange={e => setF({ ...f, deadline: e.target.value || undefined })} /></Field>
        <Field label="Icon"><div className="emoji-pick">{GOAL_EMOJI.map(e => <button type="button" key={e} className={f.emoji === e ? 'on' : ''} onClick={() => setF({ ...f, emoji: e })}>{e}</button>)}</div></Field>
        <div className="form-actions span-2">
          {f.id && <button type="button" className="btn btn-danger" onClick={() => { if (confirm('Delete goal?')) { update(d => { d.goals = d.goals.filter(g => g.id !== f.id) }); onClose() } }}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function DepositForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useStore()
  const [amt, setAmt] = useState(0)
  return (
    <Modal open title={`${goal.emoji} Add to ${goal.name}`} onClose={onClose}>
      <form className="form-grid" onSubmit={e => { e.preventDefault(); update(d => { d.goals.find(g => g.id === goal.id)!.saved += amt }); onClose() }}>
        <Field label="Amount" span hint="Use a negative number to withdraw"><NumInput autoFocus required value={amt} placeholder="0" onChange={setAmt} /></Field>
        <div className="form-actions span-2"><span className="grow" /><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn">Add</button></div>
      </form>
    </Modal>
  )
}
