import type { Allocation, AppData, Bucket, CreditCard, Emi, Expense, Income } from './types'

export const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Rent & Housing', 'Utilities', 'Transport', 'Fuel',
  'Shopping', 'Entertainment', 'Health', 'Education', 'Travel', 'Insurance',
  'Subscriptions', 'Personal Care', 'Gifts & Donations', 'EMI & Loans', 'Other',
  'SIP & Mutual Funds', 'Stocks', 'Fixed Deposits', 'PPF / NPS / EPF', 'Gold', 'Other Investments',
]

export const BUCKETS: { id: Bucket; label: string; icon: string; color: string; hint: string }[] = [
  { id: 'needs', label: 'Needs', icon: '🏠', color: 'var(--c-needs)', hint: 'Essentials you must pay: rent, groceries, bills, EMIs' },
  { id: 'wants', label: 'Wants', icon: '🎉', color: 'var(--c-wants)', hint: 'Nice-to-haves: dining out, shopping, entertainment' },
  { id: 'invest', label: 'Investments', icon: '📈', color: 'var(--c-invest)', hint: 'Money put to work: SIPs, stocks, FDs, PPF' },
]

export const BUCKET_LABEL: Record<Bucket, string> = { needs: 'Needs', wants: 'Wants', invest: 'Investments' }

export const DEFAULT_BUCKETS: Record<string, Bucket> = {
  'Food & Dining': 'wants', Groceries: 'needs', 'Rent & Housing': 'needs', Utilities: 'needs', Transport: 'needs',
  Fuel: 'needs', Shopping: 'wants', Entertainment: 'wants', Health: 'needs', Education: 'needs', Travel: 'wants',
  Insurance: 'needs', 'EMI & Loans': 'needs', Subscriptions: 'wants', 'Personal Care': 'wants', 'Gifts & Donations': 'wants', Other: 'wants',
  'SIP & Mutual Funds': 'invest', Stocks: 'invest', 'Fixed Deposits': 'invest', 'PPF / NPS / EPF': 'invest',
  Gold: 'invest', 'Other Investments': 'invest',
}

export const SPLIT_PRESETS: { label: string; targets: Record<Bucket, number> }[] = [
  { label: '50 / 30 / 20 (classic)', targets: { needs: 50, wants: 30, invest: 20 } },
  { label: '60 / 20 / 20', targets: { needs: 60, wants: 20, invest: 20 } },
  { label: '70 / 20 / 10', targets: { needs: 70, wants: 20, invest: 10 } },
  { label: '40 / 30 / 30 (aggressive saver)', targets: { needs: 40, wants: 30, invest: 30 } },
]

export function getAllocation(data: AppData): Allocation & { map: Record<string, Bucket> } {
  const a = data.settings.allocation
  const targets = a?.targets ?? SPLIT_PRESETS[0].targets
  const categoryBuckets = a?.categoryBuckets ?? {}
  return {
    targets,
    categoryBuckets,
    emiBucket: a?.emiBucket ?? 'needs',
    map: { ...DEFAULT_BUCKETS, ...categoryBuckets },
  }
}

export function bucketOf(e: Pick<Expense, 'category' | 'bucket'>, map: Record<string, Bucket>): Bucket {
  return e.bucket ?? map[e.category] ?? 'wants'
}

export const INCOME_CATEGORIES = [
  'Salary', 'Business', 'Freelance', 'Rental', 'Interest & Dividends', 'Bonus', 'Pension', 'Other',
]

export const TRIP_CATEGORIES = [
  'Flights', 'Train / Bus', 'Stay', 'Food', 'Local Transport', 'Activities',
  'Shopping', 'Visa & Docs', 'Insurance', 'Misc',
]

export const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍽️', Groceries: '🛒', 'Rent & Housing': '🏠', Utilities: '💡', Transport: '🚕',
  Fuel: '⛽', Shopping: '🛍️', Entertainment: '🎬', Health: '🩺', Education: '🎓', Travel: '✈️',
  Insurance: '🛡️', Subscriptions: '📺', 'Personal Care': '💇', 'Gifts & Donations': '🎁', 'EMI & Loans': '🏦', Other: '📦',
  Flights: '✈️', 'Train / Bus': '🚆', Stay: '🏨', Food: '🍜', 'Local Transport': '🛺',
  Activities: '🎢', 'Visa & Docs': '🛂', Misc: '🧳',
  'SIP & Mutual Funds': '📊', Stocks: '📈', 'Fixed Deposits': '🏦', 'PPF / NPS / EPF': '🧓', Gold: '🪙', 'Other Investments': '💼',
}

export const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
  '#8b5cf6', '#84cc16', '#f97316', '#14b8a6', '#64748b', '#eab308',
]

export const CURRENCIES = [
  { code: 'INR', label: '₹ Indian Rupee', locale: 'en-IN' },
  { code: 'USD', label: '$ US Dollar', locale: 'en-US' },
  { code: 'EUR', label: '€ Euro', locale: 'de-DE' },
  { code: 'GBP', label: '£ British Pound', locale: 'en-GB' },
  { code: 'AED', label: 'AED UAE Dirham', locale: 'en-AE' },
  { code: 'SGD', label: 'S$ Singapore Dollar', locale: 'en-SG' },
  { code: 'CAD', label: 'C$ Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', label: 'A$ Australian Dollar', locale: 'en-AU' },
]

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const todayISO = () => toISO(new Date())
export const ymOf = (date: string) => date.slice(0, 7)
export const currentYM = () => ymOf(todayISO())

export function parseISO(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthsBetween(fromYM: string, toYM: string) {
  const [y1, m1] = fromYM.split('-').map(Number)
  const [y2, m2] = toYM.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

export function lastNMonths(n: number, endYM = currentYM()) {
  return Array.from({ length: n }, (_, i) => addMonths(endYM, i - n + 1))
}

export function monthLabel(ym: string, long = false) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' })
}

export function dateLabel(date: string) {
  return parseISO(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysUntil(date: string) {
  const t = parseISO(todayISO()).getTime()
  return Math.round((parseISO(date).getTime() - t) / 86400000)
}

let currencyCode = 'INR'
export function setCurrency(code: string) { currencyCode = code }

export function fmt(amount: number, opts: { compact?: boolean; decimals?: boolean } = {}) {
  const locale = CURRENCIES.find(c => c.code === currencyCode)?.locale ?? 'en-US'
  const value = Number.isFinite(amount) ? amount : 0
  const nf = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, maximumFractionDigits: opts.decimals ? 2 : 0 })
  if (!opts.compact) return nf.format(value)
  // Intl's compact notation is inconsistent across locales (en-IN gives "T" for thousand), so do it by hand
  const symbol = nf.formatToParts(0).find(p => p.type === 'currency')?.value ?? ''
  const units = currencyCode === 'INR'
    ? [[1e7, 'Cr'], [1e5, 'L'], [1e3, 'K']] as const
    : [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const
  const abs = Math.abs(value)
  const unit = units.find(([n]) => abs >= n)
  const body = unit ? `${+(abs / unit[0]).toFixed(1)}${unit[1]}` : String(Math.round(abs))
  return `${value < 0 ? '-' : ''}${symbol}${body}`
}

export const pct = (v: number) => `${Math.round(v)}%`

// ---------- Income & expense aggregation ----------

/** Recurring entries count in every month on/after their start month. */
function countsInMonth(entry: { date: string; recurring?: boolean }, ym: string) {
  const start = ymOf(entry.date)
  return entry.recurring ? start <= ym : start === ym
}

export function incomeInMonth(incomes: Income[], ym: string, memberId?: string) {
  return incomes
    .filter(i => (!memberId || i.memberId === memberId) && countsInMonth(i, ym))
    .reduce((s, i) => s + i.amount, 0)
}

export function expensesInMonth(expenses: Expense[], ym: string) {
  return expenses.filter(e => countsInMonth(e, ym))
}

export function sumBy<T>(items: T[], f: (t: T) => number) {
  return items.reduce((s, t) => s + f(t), 0)
}

export function groupSum<T>(items: T[], key: (t: T) => string, val: (t: T) => number) {
  const out: Record<string, number> = {}
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + val(it)
  return out
}

// ---------- EMI maths ----------

export function emiMonthly(principal: number, annualRate: number, months: number) {
  if (months <= 0) return 0
  const r = annualRate / 12 / 100
  if (r === 0) return principal / months
  const f = Math.pow(1 + r, months)
  return (principal * r * f) / (f - 1)
}

export function emiStatus(emi: Emi, today = todayISO()) {
  const monthly = emiMonthly(emi.principal, emi.rate, emi.tenure)
  const startYM = ymOf(emi.startDate)
  const nowYM = ymOf(today)
  let paid = monthsBetween(startYM, nowYM) + (Number(today.slice(8)) >= Number(emi.startDate.slice(8)) ? 1 : 0)
  paid = Math.max(0, Math.min(emi.tenure, paid))
  const remaining = emi.tenure - paid
  const r = emi.rate / 12 / 100
  const outstanding = remaining === 0 ? 0
    : r === 0 ? emi.principal - monthly * paid
    : emi.principal * Math.pow(1 + r, paid) - monthly * (Math.pow(1 + r, paid) - 1) / r
  const totalPayable = monthly * emi.tenure
  const endYM = addMonths(startYM, emi.tenure - 1)
  const sharedPct = sumBy(emi.shares, s => s.percent)
  const nextDueYM = remaining > 0 ? addMonths(startYM, paid) : undefined
  return {
    monthly,
    paid,
    remaining,
    outstanding: Math.max(0, outstanding),
    totalPayable,
    totalInterest: totalPayable - emi.principal,
    endYM,
    startYM,
    progress: emi.tenure ? paid / emi.tenure : 1,
    sharedPct,
    yourMonthly: monthly * (1 - sharedPct / 100),
    active: remaining > 0 && paid > 0,
    nextDueYM,
    nextDueDate: nextDueYM ? `${nextDueYM}-${emi.startDate.slice(8)}` : undefined,
  }
}

/** Is an EMI instalment due in the given month? */
export function emiDueIn(emi: Emi, ym: string) {
  const start = ymOf(emi.startDate)
  return ym >= start && ym <= addMonths(start, emi.tenure - 1)
}

/** For a shared EMI: what each member owes so far vs what they've paid back. */
export function shareLedger(emi: Emi, today = todayISO()) {
  const st = emiStatus(emi, today)
  const dueMonths = Array.from({ length: st.paid }, (_, i) => addMonths(st.startYM, i))
  return emi.shares.map(s => {
    const perMonth = st.monthly * s.percent / 100
    const settledMonths = dueMonths.filter(m => emi.settlements[m]?.includes(s.memberId)).length
    const pendingMonths = dueMonths.length - settledMonths
    return {
      memberId: s.memberId,
      percent: s.percent,
      perMonth,
      settledMonths,
      pendingMonths,
      pendingAmount: pendingMonths * perMonth,
      settledAmount: settledMonths * perMonth,
      remainingFuture: st.remaining * perMonth,
    }
  })
}

// ---------- Credit cards ----------

function nextDayOfMonth(day: number, from: Date) {
  const make = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()))
  let d = make(from.getFullYear(), from.getMonth())
  if (d < from) d = make(from.getFullYear(), from.getMonth() + 1)
  return d
}

export function cardStatus(card: CreditCard, data: AppData) {
  const today = parseISO(todayISO())
  const unbilledItems = data.expenses.filter(e => e.cardId === card.id && !e.billed)
  const unbilled = sumBy(unbilledItems, e => e.amount)
  const cardEmis = data.emis.filter(e => e.cardId === card.id).map(e => ({ emi: e, st: emiStatus(e) }))
  const emiBlocked = sumBy(cardEmis, x => x.st.outstanding)
  const emiMonthlyTotal = sumBy(cardEmis.filter(x => x.st.remaining > 0), x => x.st.monthly)
  const used = unbilled + card.billedOutstanding + emiBlocked
  const nextStatement = nextDayOfMonth(card.billingDay, today)
  const nextDue = nextDayOfMonth(card.dueDay, today)
  return {
    unbilledItems,
    unbilled,
    emiBlocked,
    emiMonthlyTotal,
    used,
    available: Math.max(0, card.limit - used),
    utilization: card.limit ? (used / card.limit) * 100 : 0,
    nextStatement: toISO(nextStatement),
    nextDue: toISO(nextDue),
    cardEmis,
  }
}

// ---------- Trips ----------

export function tripSettlement(travelers: string[], items: { actual: number; paidBy?: string }[]) {
  const total = sumBy(items, i => i.actual)
  if (!travelers.length) return { total, share: 0, balances: [], transfers: [] }
  const share = total / travelers.length
  const paid = groupSum(items.filter(i => i.paidBy), i => i.paidBy!, i => i.actual)
  const balances = travelers.map(t => ({ name: t, paid: paid[t] ?? 0, balance: (paid[t] ?? 0) - share }))
  const debtors = balances.filter(b => b.balance < -0.5).map(b => ({ ...b, amt: -b.balance }))
  const creditors = balances.filter(b => b.balance > 0.5).map(b => ({ ...b, amt: b.balance }))
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amt, creditors[j].amt)
    transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: amt })
    debtors[i].amt -= amt
    creditors[j].amt -= amt
    if (debtors[i].amt < 0.5) i++
    if (creditors[j].amt < 0.5) j++
  }
  return { total, share, balances, transfers }
}

// ---------- Needs / wants / investments ----------

/** Month outflow per bucket; your share of EMIs goes to the bucket chosen in the allocation settings. */
export function bucketTotals(data: AppData, ym: string) {
  const { map } = getAllocation(data)
  const totals: Record<Bucket, number> = { needs: 0, wants: 0, invest: 0 }
  const emiRows = emiExpenseRows(data, ym)
  for (const e of [...expensesInMonth(data.expenses, ym), ...emiRows]) totals[bucketOf(e, map)] += e.amount
  return { ...totals, emi: sumBy(emiRows, e => e.amount) }
}

export const EMI_CATEGORY = 'EMI & Loans'

/**
 * One expense-shaped row per EMI instalment due in `ym`, so EMIs show up (and count) on the Expenses page.
 * The amount is your share; family members' shares are tracked on the Shared EMIs tab.
 */
export function emiExpenseRows(data: AppData, ym: string): Expense[] {
  const { emiBucket, map } = getAllocation(data)
  const self = data.members.find(m => m.isSelf)?.id
  return data.emis.filter(e => emiDueIn(e, ym)).map(e => {
    const st = emiStatus(e)
    const [y, m] = ym.split('-').map(Number)
    const day = Math.min(Number(e.startDate.slice(8)) || 1, new Date(y, m, 0).getDate())
    return {
      id: `emi:${e.id}:${ym}`,
      emiId: e.id,
      description: `${e.title} EMI`,
      category: e.category || EMI_CATEGORY,
      amount: Math.round(st.yourMonthly * 100) / 100,
      date: `${ym}-${String(day).padStart(2, '0')}`,
      memberId: e.memberId ?? self,
      method: e.cardId ? 'card' : 'bank',
      cardId: e.cardId,
      billed: true,
      // An EMI given its own category (an iPhone → Shopping) follows that category; plain loans use the EMI setting
      bucket: e.category && e.category !== EMI_CATEGORY ? map[e.category] ?? emiBucket : emiBucket,
      instalment: `${monthsBetween(ymOf(e.startDate), ym) + 1}/${e.tenure}`,
    }
  })
}
