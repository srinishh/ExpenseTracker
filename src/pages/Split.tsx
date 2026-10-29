import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { Card, NumInput, PageHeader, Progress, Stat } from '../components/ui'
import { MoneyTooltip } from './Dashboard'
import type { Bucket } from '../types'
import {
  BUCKETS, BUCKET_LABEL, CATEGORY_EMOJI, DEFAULT_BUCKETS, EXPENSE_CATEGORIES, SPLIT_PRESETS, addMonths, bucketOf, bucketTotals, emiExpenseRows,
  currentYM, expensesInMonth, fmt, getAllocation, groupSum, incomeInMonth, lastNMonths, monthLabel, pct,
} from '../utils'

export default function Split() {
  const { data, update } = useStore()
  const [ym, setYm] = useState(currentYM())
  const alloc = getAllocation(data)
  const income = incomeInMonth(data.incomes, ym)
  const totals = bucketTotals(data, ym)
  const targetSum = alloc.targets.needs + alloc.targets.wants + alloc.targets.invest

  const byBucket = (b: Bucket) => {
    const rows = [...expensesInMonth(data.expenses, ym), ...emiExpenseRows(data, ym)].filter(e => bucketOf(e, alloc.map) === b)
    const cats = Object.entries(groupSum(rows, e => e.category, e => e.amount)).map(([name, value]) => ({ name, value }))
    return cats.sort((a, c) => c.value - a.value)
  }

  const trend = lastNMonths(6, ym).map(m => ({ label: monthLabel(m), income: incomeInMonth(data.incomes, m), ...bucketTotals(data, m) }))

  const setAlloc = (fn: (a: ReturnType<typeof getAllocation>) => void) => update(d => {
    const a = getAllocation(d)
    fn(a)
    d.settings.allocation = { targets: a.targets, categoryBuckets: a.categoryBuckets, emiBucket: a.emiBucket }
  })
  const setCategory = (cat: string, b: Bucket) => setAlloc(a => {
    const next = { ...a.categoryBuckets }
    if (DEFAULT_BUCKETS[cat] === b) delete next[cat]
    else next[cat] = b
    a.categoryBuckets = next
  })
  const changed = Object.keys(alloc.categoryBuckets).length

  return (
    <div className="page">
      <PageHeader title="Needs · Wants · Investments" subtitle="Split your income with intention: essentials, enjoyment, and your future"
        actions={
          <div className="month-picker">
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Previous month">‹</button>
            <span>{monthLabel(ym, true)}</span>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Next month">›</button>
          </div>
        } />

      <div className="grid stats-4">
        <Stat icon="💵" label="Family income" value={fmt(income)} tone="good" sub={`Target split ${alloc.targets.needs} / ${alloc.targets.wants} / ${alloc.targets.invest}`} />
        {BUCKETS.map(b => {
          const actual = income ? totals[b.id] / income * 100 : 0
          const target = alloc.targets[b.id]
          const targetAmt = income * target / 100
          const diff = totals[b.id] - targetAmt
          const bad = b.id === 'invest' ? diff < 0 : diff > 0
          return (
            <Stat key={b.id} icon={b.icon} label={b.label} value={fmt(totals[b.id])} tone={bad ? (b.id === 'invest' ? 'warn' : 'bad') : 'good'}
              sub={<>
                {pct(actual)} of income · target {target}% ({fmt(targetAmt, { compact: true })})
                <Progress value={totals[b.id]} max={targetAmt || 1} tone={bad ? 'bad' : 'good'} thin />
                <span className={bad ? 'text-bad' : 'text-good'}>
                  {b.id === 'invest'
                    ? diff < 0 ? `${fmt(-diff)} short of target` : `${fmt(diff)} above target 🎉`
                    : diff > 0 ? `${fmt(diff)} over target` : `${fmt(-diff)} room left`}
                </span>
              </>} />
          )
        })}
      </div>

      <div className="grid cols-3">
        {BUCKETS.map(b => {
          const cats = byBucket(b.id)
          return (
            <Card key={b.id} title={<>{b.icon} {b.label} <span className="muted small">· {fmt(totals[b.id])}</span></>}>
              <p className="muted small mb">{b.hint}</p>
              {cats.length ? (
                <ul className="legend-list">
                  {cats.map(c => (
                    <li key={c.name}>
                      <span>{CATEGORY_EMOJI[c.name] ?? '📦'}</span>
                      <span className="grow">{c.name}</span>
                      <span className="muted small">{totals[b.id] ? pct(c.value / totals[b.id] * 100) : ''}</span>
                      <b>{fmt(c.value)}</b>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">Nothing this month.</p>}
            </Card>
          )
        })}
      </div>

      <Card title="Last 6 months">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v, { compact: true })} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {BUCKETS.map((b, i) => (
              <Bar key={b.id} dataKey={b.id} name={b.label} stackId="s" fill={b.color} maxBarSize={36}
                radius={i === BUCKETS.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
            <Line dataKey="income" name="Income" stroke="var(--c-income)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="⚙️ Your split">
        <p className="muted small mb">How much of your income should go to each bucket. Pick a preset or type your own percentages.</p>
        <div className="row gap wrap mb">
          {SPLIT_PRESETS.map(p => {
            const on = BUCKETS.every(b => p.targets[b.id] === alloc.targets[b.id])
            return <button key={p.label} className={`chip ${on ? 'on' : ''}`} onClick={() => setAlloc(a => { a.targets = { ...p.targets } })}>{p.label}</button>
          })}
        </div>
        <div className="target-grid">
          {BUCKETS.map(b => (
            <label key={b.id} className="target-input">
              <span className="dot" style={{ background: b.color }} />
              <span className="grow">{b.icon} {b.label}</span>
              <NumInput min={0} max={100} value={alloc.targets[b.id]} aria-label={`${b.label} target %`}
                onChange={v => setAlloc(a => { a.targets = { ...a.targets, [b.id]: Math.max(0, Math.min(100, Math.round(v))) } })} />
              <span className="muted">%</span>
            </label>
          ))}
        </div>
        <div className="split-bar mt" aria-hidden>
          {BUCKETS.map(b => <div key={b.id} style={{ flex: alloc.targets[b.id], background: b.color }}>{alloc.targets[b.id] >= 8 && `${alloc.targets[b.id]}%`}</div>)}
        </div>
        <p className={`small mt ${targetSum === 100 ? 'muted' : 'text-bad'}`}>
          {targetSum === 100 ? '✓ Adds up to 100%' : `Adds up to ${targetSum}%. Adjust so it totals 100%.`}
        </p>
        <hr />
        <div className="row-between wrap gap">
          <div>
            <b>EMIs count as</b>
            <div className="muted small">Your share of loan & card EMIs goes into this bucket, unless you give an EMI its own category</div>
          </div>
          <BucketPicker value={alloc.emiBucket} onChange={b => setAlloc(a => { a.emiBucket = b })} />
        </div>
      </Card>

      <Card title="🗂️ Which categories go where"
        action={changed > 0 && <button className="link" onClick={() => confirm('Reset all categories to their default buckets?') && setAlloc(a => { a.categoryBuckets = {} })}>Reset to defaults ({changed} changed)</button>}>
        <p className="muted small mb">Choose the bucket for each expense category. You can also override the bucket on a single expense when you add or edit it.</p>
        <div className="cat-map">
          {EXPENSE_CATEGORIES.map(cat => {
            const b = alloc.map[cat] ?? 'wants'
            const custom = alloc.categoryBuckets[cat] !== undefined
            return (
              <div key={cat} className="cat-row">
                <span className="tx-icon">{CATEGORY_EMOJI[cat] ?? '📦'}</span>
                <span className="grow">{cat}{custom && <span className="pill" title={`Default: ${BUCKET_LABEL[DEFAULT_BUCKETS[cat]]}`}>custom</span>}</span>
                <BucketPicker value={b} onChange={v => setCategory(cat, v)} />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export function BucketPicker({ value, onChange }: { value: Bucket; onChange: (b: Bucket) => void }) {
  return (
    <div className="seg bucket-seg" role="radiogroup">
      {BUCKETS.map(b => (
        <button key={b.id} type="button" role="radio" aria-checked={value === b.id} className={value === b.id ? `on b-${b.id}` : ''} onClick={() => onChange(b.id)}>
          {b.icon} {b.id === 'invest' ? 'Invest' : b.label}
        </button>
      ))}
    </div>
  )
}
