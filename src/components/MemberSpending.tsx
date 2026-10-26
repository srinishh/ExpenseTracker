import { Avatar, Empty } from './ui'
import type { Bucket, Expense, Member } from '../types'
import { BUCKETS, CATEGORY_EMOJI, bucketOf, fmt, groupSum, pct, sumBy } from '../utils'

export const FAMILY = 'family' // expenses not tagged to one member
const TOP_CATEGORIES = 5

interface Props {
  rows: Expense[]
  members: Member[]
  map: Record<string, Bucket>
  selected: string
  onSelect: (id: string) => void
}

/**
 * One small panel per family member: their categories as labelled bars, plus a needs/wants/investments strip.
 * Small multiples instead of one stacked chart: there are ~20 categories, too many to tell apart by colour,
 * so every bar is named in text and drawn in the member's own colour.
 */
export function MemberSpending({ rows, members, map, selected, onSelect }: Props) {
  const total = sumBy(rows, e => e.amount)
  const known = new Set(members.map(m => m.id))
  const groups = [
    ...members.map(m => ({ id: m.id, name: m.name, sub: m.relation, color: m.color, rows: rows.filter(e => e.memberId === m.id) })),
    { id: FAMILY, name: 'Whole family', sub: 'shared costs', color: 'var(--muted)', rows: rows.filter(e => !e.memberId || !known.has(e.memberId)) },
  ].map(g => ({ ...g, total: sumBy(g.rows, e => e.amount) }))
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total)

  if (!groups.length) return <Empty icon="👥" title="No spending to compare" text="Nothing matches this month and these filters." />

  return (
    <div className="member-spend">
      {groups.map(g => {
        const cats = Object.entries(groupSum(g.rows, e => e.category, e => e.amount)).sort((a, b) => b[1] - a[1])
        const shown = cats.slice(0, TOP_CATEGORIES)
        const rest = cats.slice(TOP_CATEGORIES)
        if (rest.length) shown.push([`Other (${rest.length})`, sumBy(rest, ([, v]) => v)])
        const max = Math.max(...shown.map(([, v]) => v))
        const byBucket = groupSum(g.rows, e => bucketOf(e, map), e => e.amount)
        const on = selected === g.id
        return (
          <button key={g.id} className={`ms-panel ${on ? 'on' : ''}`} onClick={() => onSelect(on ? '' : g.id)} aria-pressed={on}
            title={on ? 'Show everyone' : `Show only ${g.name}'s expenses`}>
            <div className="ms-head">
              {g.id === FAMILY ? <span className="avatar ms-family">👪</span> : <Avatar name={g.name} color={g.color} size={30} />}
              <div className="grow">
                <b>{g.name}</b>
                <div className="muted small">{g.sub} · {pct(g.total / total * 100)} of spending</div>
              </div>
              <b className="ms-total">{fmt(g.total)}</b>
            </div>

            <div className="ms-strip" aria-hidden>
              {BUCKETS.filter(b => byBucket[b.id]).map(b => (
                <span key={b.id} style={{ flex: byBucket[b.id], background: b.color }} title={`${b.label}: ${fmt(byBucket[b.id])}`} />
              ))}
            </div>
            <div className="ms-strip-legend small">
              {BUCKETS.filter(b => byBucket[b.id]).map(b => (
                <span key={b.id}><span className="dot" style={{ background: b.color }} />{b.label} {fmt(byBucket[b.id], { compact: true })}</span>
              ))}
            </div>

            <ul className="ms-cats">
              {shown.map(([name, v]) => (
                <li key={name} title={`${name}: ${fmt(v)} (${pct(v / g.total * 100)} of ${g.name}'s spending)`}>
                  <span className="ms-label">{CATEGORY_EMOJI[name] ?? '📦'} {name}</span>
                  <span className="ms-bar-track"><span className="ms-bar" style={{ width: `${(v / max) * 100}%`, background: g.color }} /></span>
                  <span className="ms-value">{fmt(v)}</span>
                </li>
              ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}
