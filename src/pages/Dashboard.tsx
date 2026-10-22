import { useMemo, useState } from 'react'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useStore } from '../store'
import { Avatar, Card, Empty, PageHeader, Progress, Stat } from '../components/ui'
import {
  BUCKETS, CATEGORY_EMOJI, PALETTE, addMonths, bucketOf, bucketTotals, getAllocation, cardStatus, currentYM, dateLabel, daysUntil, emiDueIn, emiStatus,
  expensesInMonth, fmt, groupSum, incomeInMonth, lastNMonths, monthLabel, pct, shareLedger, sumBy, todayISO, tripSettlement,
} from '../utils'
import type { PageId } from '../App'

type Insight = { tone: 'good' | 'bad' | 'warn' | 'info'; icon: string; text: React.ReactNode }

export default function Dashboard({ go }: { go: (p: PageId) => void }) {
  const { data } = useStore()
  const [ym, setYm] = useState(currentYM())
  const isCurrent = ym === currentYM()

  const alloc = getAllocation(data)
  const calc = useMemo(() => {
    const { map } = getAllocation(data)
    // Investments are money saved, not spent, so they stay out of "Spending"
    const spends = (m: string) => expensesInMonth(data.expenses, m).filter(e => bucketOf(e, map) !== 'invest')
    const emiOut = (m: string) => sumBy(data.emis.filter(e => emiDueIn(e, m)), e => emiStatus(e).yourMonthly)
    const monthTotals = (m: string) => {
      const income = incomeInMonth(data.incomes, m)
      const spend = sumBy(spends(m), e => e.amount)
      const invested = sumBy(expensesInMonth(data.expenses, m), e => e.amount) - spend
      const emi = emiOut(m)
      return { m, label: monthLabel(m), income, spend, invested, emi, savings: income - spend - emi }
    }
    const cur = monthTotals(ym)
    const prev = monthTotals(addMonths(ym, -1))
    const trend = lastNMonths(6, ym).map(monthTotals)
    const monthExpenses = spends(ym)
    const split = bucketTotals(data, ym)
    const byCat = Object.entries(groupSum(monthExpenses, e => e.category, e => e.amount))
      .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    const byMember = data.members.map(m => ({ member: m, value: incomeInMonth(data.incomes, ym, m.id) }))
      .filter(x => x.value > 0).sort((a, b) => b.value - a.value)
    const emis = data.emis.map(e => ({ emi: e, st: emiStatus(e) }))
    const cards = data.cards.map(c => ({ card: c, st: cardStatus(c, data) }))
    const owed = data.emis.flatMap(e => shareLedger(e).map(l => ({ ...l, emi: e })))
      .filter(l => l.pendingAmount > 0.5)
    return { cur, prev, trend, byCat, byMember, emis, cards, owed, monthExpenses, split, spends }
  }, [data, ym])

  const { cur, prev, trend, byCat, byMember, emis, cards, owed, monthExpenses, split, spends } = calc
  const savingsRate = cur.income ? (cur.savings / cur.income) * 100 : 0
  const outflow = cur.spend + cur.emi
  const memberName = (id: string) => data.members.find(m => m.id === id)?.name ?? '—'

  // ---------- Smart insights ----------
  const insights: Insight[] = []
  if (cur.income > 0) {
    if (savingsRate >= 30) insights.push({ tone: 'good', icon: '🌱', text: <>Great job — the family is saving <b>{pct(savingsRate)}</b> of income this month.</> })
    else if (savingsRate >= 10) insights.push({ tone: 'warn', icon: '⚖️', text: <>Savings rate is <b>{pct(savingsRate)}</b>. Aim for 20–30% by trimming your top category.</> })
    else insights.push({ tone: 'bad', icon: '🚨', text: <>Only <b>{pct(Math.max(0, savingsRate))}</b> of income is left after spends and EMIs this month.</> })
    const emiRatio = (cur.emi / cur.income) * 100
    if (emiRatio > 40) insights.push({ tone: 'bad', icon: '🏦', text: <>EMIs take <b>{pct(emiRatio)}</b> of income — above the healthy 40% ceiling.</> })
    else if (cur.emi > 0) insights.push({ tone: emiRatio > 25 ? 'warn' : 'good', icon: '🏦', text: <>EMIs (your share) use <b>{pct(emiRatio)}</b> of family income.</> })
  }
  if (byCat[0] && cur.spend) {
    insights.push({ tone: 'info', icon: CATEGORY_EMOJI[byCat[0].name] ?? '📦', text: <><b>{byCat[0].name}</b> is the biggest spend at {fmt(byCat[0].value)} ({pct(byCat[0].value / cur.spend * 100)} of spending).</> })
  }
  if (prev.spend > 0) {
    let base = prev.spend
    let label = 'last month'
    if (isCurrent) {
      const dayNow = todayISO().slice(8)
      base = sumBy(spends(prev.m).filter(e => e.recurring || e.date.slice(8) <= dayNow), e => e.amount)
      label = 'the same point last month'
    }
    const change = base ? ((cur.spend - base) / base) * 100 : 0
    if (Math.abs(change) >= 5) {
      insights.push(change > 0
        ? { tone: 'warn', icon: '📈', text: <>Spending is <b>{pct(change)} higher</b> than {label}.</> }
        : { tone: 'good', icon: '📉', text: <>Spending is <b>{pct(-change)} lower</b> than {label}. Nice!</> })
    }
  }
  if (cur.income > 0) {
    const wantsPct = split.wants / cur.income * 100
    const investPct = split.invest / cur.income * 100
    if (wantsPct > alloc.targets.wants) insights.push({ tone: 'warn', icon: '🎉', text: <>Wants are at <b>{pct(wantsPct)}</b> of income, above your {alloc.targets.wants}% target (by {fmt(split.wants - cur.income * alloc.targets.wants / 100)}).</> })
    if (investPct < alloc.targets.invest) insights.push({ tone: 'warn', icon: '📈', text: <>Investments are <b>{pct(investPct)}</b> of income. Invest {fmt(cur.income * alloc.targets.invest / 100 - split.invest)} more to hit your {alloc.targets.invest}% target.</> })
    else insights.push({ tone: 'good', icon: '📈', text: <>You've invested <b>{pct(investPct)}</b> of income this month, meeting your {alloc.targets.invest}% target.</> })
  }
  const over = Object.entries(data.budgets).map(([cat, b]) => ({ cat, b, spent: sumBy(monthExpenses.filter(e => e.category === cat), e => e.amount) }))
    .filter(x => x.b > 0 && x.spent > x.b)
  if (over.length) insights.push({ tone: 'bad', icon: '🎯', text: <>Over budget in <b>{over.map(o => o.cat).join(', ')}</b> (by {fmt(sumBy(over, o => o.spent - o.b))}).</> })
  const highUtil = cards.filter(c => c.st.utilization > 30)
  if (highUtil.length) insights.push({ tone: 'warn', icon: '💳', text: <>{highUtil.map(c => `${c.card.bank} ${c.card.name}`).join(', ')} {highUtil.length > 1 ? 'are' : 'is'} above 30% utilization — this can dent your credit score.</> })
  const owedTotal = sumBy(owed, o => o.pendingAmount)
  if (owedTotal > 0) insights.push({ tone: 'info', icon: '🤝', text: <>Family members owe you <b>{fmt(owedTotal)}</b> for shared EMIs.</> })
  const endingSoon = emis.filter(x => x.st.remaining > 0 && x.st.remaining <= 2)
  for (const x of endingSoon) insights.push({ tone: 'good', icon: '🎉', text: <><b>{x.emi.title}</b> ends in {x.st.remaining} month{x.st.remaining > 1 ? 's' : ''} — frees up {fmt(x.st.yourMonthly)}/month.</> })
  const biggest = [...monthExpenses].filter(e => !e.recurring).sort((a, b) => b.amount - a.amount)[0]
  if (biggest) insights.push({ tone: 'info', icon: '🔎', text: <>Largest one-off spend: <b>{biggest.description}</b> ({fmt(biggest.amount)}) on {dateLabel(biggest.date)}.</> })

  // ---------- Upcoming ----------
  const upcoming: { date: string; icon: string; title: string; amount?: number }[] = []
  for (const c of cards) {
    const due = c.card.billedOutstanding
    if (due > 0) upcoming.push({ date: c.st.nextDue, icon: '💳', title: `${c.card.bank} ${c.card.name} bill due`, amount: due })
    upcoming.push({ date: c.st.nextStatement, icon: '🧾', title: `${c.card.bank} statement (unbilled ${fmt(c.st.unbilled)})` })
  }
  for (const x of emis) if (x.st.nextDueDate) upcoming.push({ date: x.st.nextDueDate, icon: '🏦', title: `${x.emi.title} EMI`, amount: x.st.monthly })
  const nextTrip = [...data.trips].filter(t => daysUntil(t.startDate) >= 0).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  if (nextTrip) upcoming.push({ date: nextTrip.startDate, icon: nextTrip.emoji, title: `${nextTrip.name} begins` })
  upcoming.sort((a, b) => a.date.localeCompare(b.date))
  const upcomingSoon = upcoming.filter(u => daysUntil(u.date) >= 0 && daysUntil(u.date) <= 45).slice(0, 7)

  const totalOutstanding = sumBy(emis, x => x.st.outstanding)
  const totalLimit = sumBy(data.cards, c => c.limit)
  const totalUsed = sumBy(cards, c => c.st.used)

  return (
    <div className="page">
      <PageHeader title="Dashboard" subtitle="Your family's money at a glance"
        actions={
          <div className="month-picker">
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Previous month">‹</button>
            <span>{monthLabel(ym, true)}</span>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Next month">›</button>
          </div>
        } />

      <div className="grid stats-4">
        <Stat icon="💵" label="Family income" value={fmt(cur.income)} tone="good"
          sub={<Delta now={cur.income} before={prev.income} />} />
        <Stat icon="🧾" label="Spending" value={fmt(cur.spend)}
          sub={<Delta now={cur.spend} before={prev.spend} inverse />} />
        <Stat icon="🏦" label="EMIs (your share)" value={fmt(cur.emi)} sub={`${emis.filter(x => emiDueIn(x.emi, ym)).length} active EMIs`} />
        <Stat icon="🌱" label="Net savings" value={fmt(cur.savings)} tone={cur.savings >= 0 ? 'accent' : 'bad'}
          sub={cur.income ? `${pct(savingsRate)} savings rate${cur.invested ? ` · ${fmt(cur.invested, { compact: true })} invested` : ''}` : 'Add income to see rate'} />
      </div>

      <Card title="⚖️ Needs · Wants · Investments" action={<button className="link" onClick={() => go('split')}>Details & settings →</button>}>
        <div className="split-strip">
          {BUCKETS.map(b => {
            const actual = cur.income ? split[b.id] / cur.income * 100 : 0
            const target = alloc.targets[b.id]
            const bad = b.id === 'invest' ? actual < target : actual > target
            return (
              <div key={b.id} className="split-mini">
                <div className="row-between"><span>{b.icon} {b.label}</span><b>{fmt(split[b.id])}</b></div>
                <div className="split-track">
                  <div className="split-fill" style={{ width: `${Math.min(100, actual)}%`, background: b.color }} />
                  <span className="split-target" style={{ left: `${Math.min(100, target)}%` }} title={`Target ${target}%`} />
                </div>
                <div className={`small ${bad ? 'text-bad' : 'muted'}`}>{pct(actual)} of income · target {target}%</div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid cols-3-1">
        <Card title="Income vs outflow · last 6 months">
          <div className="chart">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v, { compact: true })} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="var(--c-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="spend" name="Spending" stackId="out" fill="var(--c-spend)" maxBarSize={28} />
                <Bar dataKey="emi" name="EMIs" stackId="out" fill="var(--c-emi)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line dataKey="savings" name="Savings" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="✨ Insights">
          {insights.length ? (
            <ul className="insights">
              {insights.slice(0, 6).map((i, k) => (
                <li key={k} className={`insight tone-${i.tone}`}><span>{i.icon}</span><span>{i.text}</span></li>
              ))}
            </ul>
          ) : <Empty icon="✨" title="Insights appear as you add data" />}
        </Card>
      </div>

      <div className="grid cols-3">
        <Card title="Where the money went">
          {byCat.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="var(--surface)">
                      {byCat.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={<MoneyTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><div className="muted small">Total</div><b>{fmt(cur.spend, { compact: true })}</b></div>
              </div>
              <ul className="legend-list">
                {byCat.slice(0, 6).map((c, i) => (
                  <li key={c.name}>
                    <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="grow">{c.name}</span>
                    <span className="muted small">{pct(c.value / cur.spend * 100)}</span>
                    <b>{fmt(c.value)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : <Empty icon="🧾" title="No spending this month" />}
        </Card>

        <Card title="Who earned" action={<button className="link" onClick={() => go('income')}>Details →</button>}>
          {byMember.length ? (
            <ul className="rank-list">
              {byMember.map(({ member, value }) => (
                <li key={member.id}>
                  <Avatar name={member.name} color={member.color} />
                  <div className="grow">
                    <div className="row-between"><span>{member.name} <span className="muted small">· {member.relation}</span></span><b>{fmt(value)}</b></div>
                    <Progress value={value} max={cur.income} tone="accent" thin />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="👨‍👩‍👧" title="No income recorded" />}
        </Card>

        <Card title="Upcoming 45 days">
          {upcomingSoon.length ? (
            <ul className="timeline">
              {upcomingSoon.map((u, i) => {
                const d = daysUntil(u.date)
                return (
                  <li key={i}>
                    <span className="tl-icon">{u.icon}</span>
                    <div className="grow">
                      <div>{u.title}</div>
                      <div className="muted small">{dateLabel(u.date)} · {d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`}</div>
                    </div>
                    {u.amount !== undefined && <b>{fmt(u.amount)}</b>}
                  </li>
                )
              })}
            </ul>
          ) : <Empty icon="📅" title="Nothing due soon" />}
        </Card>
      </div>

      <div className="grid cols-3">
        <Card title="Credit cards" action={<button className="link" onClick={() => go('cards')}>Manage →</button>}>
          {cards.length ? (
            <>
              <div className="row-between mb"><span className="muted">Overall utilization</span><b>{pct(totalLimit ? totalUsed / totalLimit * 100 : 0)}</b></div>
              <Progress value={totalUsed} max={totalLimit} />
              <ul className="rank-list mt">
                {cards.map(({ card, st }) => (
                  <li key={card.id}>
                    <span className="card-chip" style={{ background: card.color }}>{card.last4}</span>
                    <div className="grow">
                      <div className="row-between"><span>{card.bank} {card.name}</span><span className="small">{pct(st.utilization)}</span></div>
                      <div className="muted small">Unbilled {fmt(st.unbilled)} · EMI {fmt(st.emiMonthlyTotal)}/mo</div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : <Empty icon="💳" title="No cards added" action={<button className="btn btn-sm" onClick={() => go('cards')}>Add a card</button>} />}
        </Card>

        <Card title="Loans & EMIs">
          <div className="row-between mb"><span className="muted">Total outstanding</span><b>{fmt(totalOutstanding)}</b></div>
          {emis.filter(x => x.st.remaining > 0).length ? (
            <ul className="rank-list">
              {emis.filter(x => x.st.remaining > 0).sort((a, b) => a.st.remaining - b.st.remaining).slice(0, 5).map(({ emi, st }) => (
                <li key={emi.id}>
                  <div className="grow">
                    <div className="row-between"><span>{emi.title}{emi.shares.length > 0 && <span className="pill">shared</span>}</span><b>{fmt(st.monthly)}</b></div>
                    <Progress value={st.paid} max={emi.tenure} tone="accent" thin />
                    <div className="muted small">{st.paid}/{emi.tenure} paid · ends {monthLabel(st.endYM)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="🏦" title="No active EMIs" />}
          {owed.length > 0 && (
            <div className="owed-box">
              <div className="small muted mb">🤝 Family owes you</div>
              {owed.map((o, i) => (
                <div key={i} className="row-between small"><span>{memberName(o.memberId)} · {o.emi.title}</span><b>{fmt(o.pendingAmount)}</b></div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Goals & trips" action={<button className="link" onClick={() => go('planning')}>All goals →</button>}>
          {data.goals.slice(0, 3).map(g => (
            <div key={g.id} className="goal-mini">
              <div className="row-between"><span>{g.emoji} {g.name}</span><span className="small muted">{pct(g.saved / g.target * 100)}</span></div>
              <Progress value={g.saved} max={g.target} tone="accent" thin />
            </div>
          ))}
          {nextTrip && (() => {
            const s = tripSettlement(nextTrip.travelers, nextTrip.items)
            const planned = sumBy(nextTrip.items, i => i.planned)
            return (
              <button className="trip-teaser" onClick={() => go('trips')}>
                <span className="trip-emoji">{nextTrip.emoji}</span>
                <div className="grow">
                  <b>{nextTrip.name}</b>
                  <div className="small muted">in {daysUntil(nextTrip.startDate)} days · planned {fmt(planned)} of {fmt(nextTrip.budget)}</div>
                  <div className="small muted">spent so far {fmt(s.total)}</div>
                </div>
              </button>
            )
          })()}
          {!data.goals.length && !nextTrip && <Empty icon="🎯" title="Set a goal or plan a trip" />}
        </Card>
      </div>

      <p className="muted small center">Total outflow for {monthLabel(ym, true)}: {fmt(outflow)} · Credit available: {fmt(Math.max(0, totalLimit - totalUsed))}</p>
    </div>
  )
}

function Delta({ now, before, inverse }: { now: number; before: number; inverse?: boolean }) {
  if (!before) return <span className="muted">—</span>
  const change = ((now - before) / before) * 100
  const good = inverse ? change <= 0 : change >= 0
  return <span className={good ? 'text-good' : 'text-bad'}>{change >= 0 ? '▲' : '▼'} {pct(Math.abs(change))} vs last month</span>
}

export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip">
      {label && <div className="tooltip-title">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span className="dot" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name}</span><b>{fmt(p.value)}</b>
        </div>
      ))}
    </div>
  )
}
