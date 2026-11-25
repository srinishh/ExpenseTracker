import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppData, CreditCard, Emi, Expense } from './types'
import {
  addMonths, bucketTotals, cardStatus, dueDate, emiDueIn, emiExpenseRows, emiMonthly, emiStatus,
  isPaid, monthsBetween, shareLedger, tripSettlement,
} from './utils'

// ---------- fixtures ----------

function makeData(over: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    isSample: false,
    members: [{ id: 'me', name: 'Me', relation: 'Self', color: '#000', isSelf: true }],
    incomes: [],
    expenses: [],
    cards: [],
    emis: [],
    trips: [],
    goals: [],
    budgets: {},
    settings: { currency: 'INR', theme: 'system' },
    ...over,
  }
}

function makeEmi(over: Partial<Emi> = {}): Emi {
  return {
    id: 'emi1',
    title: 'Laptop',
    principal: 100000,
    rate: 12,
    tenure: 12,
    startDate: '2026-01-10',
    shares: [],
    settlements: {},
    ...over,
  }
}

function makeCard(over: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card1',
    name: 'Rewards',
    bank: 'Bank',
    last4: '1234',
    limit: 200000,
    billingDay: 15,
    dueDay: 5,
    color: '#000',
    billedOutstanding: 0,
    ...over,
  }
}

function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'x1',
    description: 'Thing',
    category: 'Shopping',
    amount: 1000,
    date: '2026-03-05',
    method: 'card',
    ...over,
  }
}

/** Month-by-month reducing balance, as a bank would print it. */
function amortize(principal: number, annualRate: number, months: number) {
  const r = annualRate / 12 / 100
  const monthly = emiMonthly(principal, annualRate, months)
  const rows: { interest: number; principalPaid: number; balance: number }[] = []
  let balance = principal
  for (let i = 0; i < months; i++) {
    const interest = balance * r
    const principalPaid = monthly - interest
    balance -= principalPaid
    rows.push({ interest, principalPaid, balance })
  }
  return { monthly, rows }
}

/** Freeze "today" for functions that read the clock. Noon local time avoids any date rollover. */
function setToday(iso: string) {
  vi.useFakeTimers()
  const [y, m, d] = iso.split('-').map(Number)
  vi.setSystemTime(new Date(y, m - 1, d, 12))
}

afterEach(() => {
  vi.useRealTimers()
})

// ---------- month helpers ----------

describe('month helpers', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-05', 0)).toBe('2026-05')
  })

  it('counts months between two months', () => {
    expect(monthsBetween('2026-01', '2026-12')).toBe(11)
    expect(monthsBetween('2025-11', '2026-02')).toBe(3)
    expect(monthsBetween('2026-03', '2026-01')).toBe(-2)
  })
})

// ---------- EMI maths ----------

describe('emiMonthly', () => {
  it('matches the standard reducing-balance formula', () => {
    // ₹1,00,000 at 12% p.a. for 12 months is the textbook ₹8,884.88
    expect(emiMonthly(100000, 12, 12)).toBeCloseTo(8884.88, 2)
    // ₹10,00,000 at 9% p.a. for 60 months
    expect(emiMonthly(1000000, 9, 60)).toBeCloseTo(20758.36, 2)
  })

  it('splits principal evenly at 0% interest', () => {
    expect(emiMonthly(12000, 0, 12)).toBe(1000)
  })

  it('returns 0 for a zero or negative tenure', () => {
    expect(emiMonthly(50000, 10, 0)).toBe(0)
    expect(emiMonthly(50000, 10, -3)).toBe(0)
  })

  it('pays the loan off exactly by the last instalment', () => {
    for (const [p, rate, n] of [[100000, 12, 12], [250000, 15.5, 24], [1000000, 8.5, 240]]) {
      const { rows } = amortize(p, rate, n)
      expect(rows[rows.length - 1].balance).toBeCloseTo(0, 4)
    }
  })

  it('front-loads interest: each instalment repays more principal than the last', () => {
    const { rows } = amortize(100000, 12, 12)
    for (let i = 1; i < rows.length; i++) expect(rows[i].principalPaid).toBeGreaterThan(rows[i - 1].principalPaid)
    expect(rows[0].interest).toBeCloseTo(1000, 6) // 1% of 1,00,000 in month one
  })
})

describe('emiStatus schedule', () => {
  const emi = makeEmi() // 1,00,000 @ 12% for 12 months, first instalment 10 Jan 2026

  it('has nothing paid the day before the first instalment', () => {
    const st = emiStatus(emi, '2026-01-09')
    expect(st.paid).toBe(0)
    expect(st.remaining).toBe(12)
    expect(st.outstanding).toBeCloseTo(100000, 6)
    expect(st.active).toBe(false)
    expect(st.nextDueYM).toBe('2026-01')
    expect(st.nextDueDate).toBe('2026-01-10')
  })

  it('counts an instalment as paid on its due day', () => {
    const st = emiStatus(emi, '2026-01-10')
    expect(st.paid).toBe(1)
    expect(st.active).toBe(true)
    expect(st.nextDueDate).toBe('2026-02-10')
  })

  it('does not count this month until the due day arrives', () => {
    expect(emiStatus(emi, '2026-03-09').paid).toBe(2)
    expect(emiStatus(emi, '2026-03-10').paid).toBe(3)
  })

  it('is fully paid and inactive after the last instalment', () => {
    const st = emiStatus(emi, '2027-06-01')
    expect(st.paid).toBe(12)
    expect(st.remaining).toBe(0)
    expect(st.outstanding).toBe(0)
    expect(st.active).toBe(false)
    expect(st.progress).toBe(1)
    expect(st.nextDueYM).toBeUndefined()
    expect(st.nextDueDate).toBeUndefined()
  })

  it('reports total payable, interest and end month', () => {
    const st = emiStatus(emi, '2026-01-01')
    expect(st.totalPayable).toBeCloseTo(8884.88 * 12, 0)
    expect(st.totalInterest).toBeCloseTo(st.totalPayable - 100000, 6)
    expect(st.endYM).toBe('2026-12')
    expect(st.startYM).toBe('2026-01')
  })

  it('moves a 31st due date to the last day of shorter months', () => {
    const emi31 = makeEmi({ startDate: '2026-01-31' })
    expect(emiStatus(emi31, '2026-01-31').nextDueDate).toBe('2026-02-28')
    expect(emiStatus(emi31, '2026-02-27').paid).toBe(1)
    // The February instalment falls on the 28th, so it counts as paid that day
    expect(emiStatus(emi31, '2026-02-28').paid).toBe(2)
    expect(emiStatus(emi31, '2026-02-28').nextDueDate).toBe('2026-03-31')
    expect(emiStatus(emi31, '2026-03-31').nextDueDate).toBe('2026-04-30')
    expect(emiStatus(makeEmi({ startDate: '2027-01-30', tenure: 24 }), '2028-01-31').nextDueDate).toBe('2028-02-29') // leap year
  })

  it('ends in the right month when the loan spans a year boundary', () => {
    expect(emiStatus(makeEmi({ startDate: '2026-11-05', tenure: 6 }), '2026-11-01').endYM).toBe('2027-04')
  })
})

describe('emiStatus outstanding principal', () => {
  it('matches a month-by-month amortisation table after every instalment', () => {
    const emi = makeEmi({ principal: 250000, rate: 15.5, tenure: 24, startDate: '2026-01-10' })
    const { rows } = amortize(250000, 15.5, 24)
    for (let k = 1; k <= 23; k++) {
      const today = `${addMonths('2026-01', k - 1)}-10`
      const st = emiStatus(emi, today)
      expect(st.paid).toBe(k)
      expect(st.outstanding).toBeCloseTo(rows[k - 1].balance, 4)
    }
  })

  it('reduces linearly on a 0% (no-cost) EMI', () => {
    const emi = makeEmi({ principal: 60000, rate: 0, tenure: 6 })
    expect(emiStatus(emi, '2026-01-10').outstanding).toBeCloseTo(50000, 6)
    expect(emiStatus(emi, '2026-03-10').outstanding).toBeCloseTo(30000, 6)
    expect(emiStatus(emi, '2026-06-10').outstanding).toBe(0)
  })

  it('never goes negative', () => {
    const emi = makeEmi({ principal: 1000, rate: 0, tenure: 3 })
    expect(emiStatus(emi, '2030-01-01').outstanding).toBe(0)
  })
})

describe('emiDueIn', () => {
  const emi = makeEmi({ startDate: '2026-11-20', tenure: 3 })

  it('is due from the start month through the last instalment month', () => {
    expect(emiDueIn(emi, '2026-10')).toBe(false)
    expect(emiDueIn(emi, '2026-11')).toBe(true)
    expect(emiDueIn(emi, '2026-12')).toBe(true)
    expect(emiDueIn(emi, '2027-01')).toBe(true)
    expect(emiDueIn(emi, '2027-02')).toBe(false)
  })
})

// ---------- Shared EMIs ----------

describe('shared EMI splits', () => {
  const emi = makeEmi({
    principal: 60000,
    rate: 0,
    tenure: 6, // ₹10,000 / month
    shares: [{ memberId: 'mom', percent: 30 }, { memberId: 'bro', percent: 20 }],
    settlements: { '2026-01': ['mom', 'bro'], '2026-02': ['mom'] },
  })

  it('leaves you the part not shared with family', () => {
    const st = emiStatus(emi, '2026-03-15')
    expect(st.sharedPct).toBe(50)
    expect(st.yourMonthly).toBeCloseTo(5000, 6)
  })

  it('tracks what each member has paid back and still owes', () => {
    const [mom, bro] = shareLedger(emi, '2026-03-15') // 3 instalments due so far
    expect(mom).toMatchObject({ memberId: 'mom', percent: 30, settledMonths: 2, pendingMonths: 1 })
    expect(mom.perMonth).toBeCloseTo(3000, 6)
    expect(mom.settledAmount).toBeCloseTo(6000, 6)
    expect(mom.pendingAmount).toBeCloseTo(3000, 6)
    expect(mom.remainingFuture).toBeCloseTo(9000, 6)

    expect(bro).toMatchObject({ memberId: 'bro', settledMonths: 1, pendingMonths: 2 })
    expect(bro.pendingAmount).toBeCloseTo(4000, 6)
    expect(bro.remainingFuture).toBeCloseTo(6000, 6)
  })

  it('ignores settlements for months not yet due', () => {
    const early = { ...emi, settlements: { '2026-05': ['mom'] } }
    const [mom] = shareLedger(early, '2026-01-15') // only January is due
    expect(mom.settledMonths).toBe(0)
    expect(mom.pendingMonths).toBe(1)
  })

  it('owes nothing before the first instalment', () => {
    const [mom] = shareLedger(emi, '2026-01-01')
    expect(mom.pendingAmount).toBe(0)
    expect(mom.remainingFuture).toBeCloseTo(18000, 6)
  })

  it('covers the whole loan: your share plus family shares equals the instalment', () => {
    const st = emiStatus(emi, '2026-03-15')
    const family = shareLedger(emi, '2026-03-15').reduce((s, l) => s + l.perMonth, 0)
    expect(st.yourMonthly + family).toBeCloseTo(st.monthly, 6)
  })
})

describe('emiExpenseRows', () => {
  it('adds one row per EMI due that month, for your share only', () => {
    const data = makeData({
      emis: [
        makeEmi({ id: 'a', principal: 60000, rate: 0, tenure: 6, shares: [{ memberId: 'mom', percent: 25 }] }),
        makeEmi({ id: 'b', startDate: '2027-01-10' }), // not started yet
      ],
    })
    const rows = emiExpenseRows(data, '2026-03')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'emi:a:2026-03',
      emiId: 'a',
      amount: 7500,
      date: '2026-03-10',
      instalment: '3/6',
      memberId: 'me',
      method: 'bank',
      category: 'EMI & Loans',
      bucket: 'needs',
    })
  })

  it('rounds the amount to paise', () => {
    const rows = emiExpenseRows(makeData({ emis: [makeEmi()] }), '2026-01')
    expect(rows[0].amount).toBe(8884.88)
  })

  it('moves a 31st due date to the last day of shorter months', () => {
    const data = makeData({ emis: [makeEmi({ startDate: '2026-01-31' })] })
    expect(emiExpenseRows(data, '2026-02')[0].date).toBe('2026-02-28')
    expect(emiExpenseRows(data, '2026-04')[0].date).toBe('2026-04-30')
    expect(emiExpenseRows(data, '2026-05')[0].date).toBe('2026-05-31')
  })

  it('puts card EMIs on the card and follows a custom category bucket', () => {
    const data = makeData({ emis: [makeEmi({ cardId: 'card1', category: 'Shopping' })] })
    const [row] = emiExpenseRows(data, '2026-02')
    expect(row).toMatchObject({ method: 'card', cardId: 'card1', category: 'Shopping', bucket: 'wants' })
  })

  it('uses the EMI bucket from allocation settings for plain loans', () => {
    const data = makeData({
      emis: [makeEmi()],
      settings: { currency: 'INR', theme: 'system', allocation: { targets: { needs: 50, wants: 30, invest: 20 }, categoryBuckets: {}, emiBucket: 'wants' } },
    })
    expect(emiExpenseRows(data, '2026-02')[0].bucket).toBe('wants')
  })
})

// ---------- Credit card statements ----------

describe('cardStatus', () => {
  it('adds unbilled spends, the billed statement and EMI-blocked limit', () => {
    setToday('2026-03-10')
    const card = makeCard({ limit: 200000, billedOutstanding: 15000 })
    const data = makeData({
      cards: [card],
      expenses: [
        makeExpense({ id: 'u1', cardId: 'card1', amount: 2500, billed: false }),
        makeExpense({ id: 'u2', cardId: 'card1', amount: 1500 }), // billed missing = unbilled
        makeExpense({ id: 'b1', cardId: 'card1', amount: 9999, billed: true }), // already on the statement
        makeExpense({ id: 'o1', cardId: 'other', amount: 7777, billed: false }), // another card
      ],
      emis: [makeEmi({ cardId: 'card1', principal: 60000, rate: 0, tenure: 6, startDate: '2026-01-10' })],
    })
    const st = cardStatus(card, data)
    expect(st.unbilledItems.map(e => e.id)).toEqual(['u1', 'u2'])
    expect(st.unbilled).toBe(4000)
    expect(st.emiBlocked).toBeCloseTo(30000, 6) // 3 of 6 instalments paid
    expect(st.emiMonthlyTotal).toBeCloseTo(10000, 6)
    expect(st.used).toBeCloseTo(4000 + 15000 + 30000, 6)
    expect(st.available).toBeCloseTo(200000 - 49000, 6)
    expect(st.utilization).toBeCloseTo(24.5, 6)
    expect(st.cardEmis).toHaveLength(1)
  })

  it('drops finished EMIs from the monthly total and blocked limit', () => {
    setToday('2027-03-10')
    const card = makeCard()
    const data = makeData({ cards: [card], emis: [makeEmi({ cardId: 'card1' })] })
    const st = cardStatus(card, data)
    expect(st.emiBlocked).toBe(0)
    expect(st.emiMonthlyTotal).toBe(0)
  })

  it('never shows negative available limit when over the limit', () => {
    setToday('2026-03-10')
    const card = makeCard({ limit: 10000, billedOutstanding: 12000 })
    const st = cardStatus(card, makeData({ cards: [card] }))
    expect(st.available).toBe(0)
    expect(st.utilization).toBeCloseTo(120, 6)
  })

  it('reports 0% utilisation for a card with no limit set', () => {
    setToday('2026-03-10')
    const card = makeCard({ limit: 0, billedOutstanding: 500 })
    expect(cardStatus(card, makeData({ cards: [card] })).utilization).toBe(0)
  })

  it('finds the next statement and due dates this month or next', () => {
    setToday('2026-03-10')
    const card = makeCard({ billingDay: 15, dueDay: 5 })
    const st = cardStatus(card, makeData({ cards: [card] }))
    expect(st.nextStatement).toBe('2026-03-15') // still ahead this month
    expect(st.nextDue).toBe('2026-04-05') // already passed, so next month
  })

  it('treats today as the next statement day when they match', () => {
    setToday('2026-03-15')
    const card = makeCard({ billingDay: 15 })
    expect(cardStatus(card, makeData({ cards: [card] })).nextStatement).toBe('2026-03-15')
  })

  it('moves a billing day past month end to the last day of the month', () => {
    setToday('2026-02-10')
    const card = makeCard({ billingDay: 31, dueDay: 30 })
    const st = cardStatus(card, makeData({ cards: [card] }))
    expect(st.nextStatement).toBe('2026-02-28')
    expect(st.nextDue).toBe('2026-02-28')
  })

  it('rolls into a short next month and across the year end', () => {
    setToday('2026-01-31')
    const card = makeCard({ billingDay: 30, dueDay: 31 })
    const st = cardStatus(card, makeData({ cards: [card] }))
    expect(st.nextStatement).toBe('2026-02-28')
    expect(st.nextDue).toBe('2026-01-31')

    setToday('2026-12-20')
    expect(cardStatus(makeCard({ billingDay: 5 }), makeData()).nextStatement).toBe('2027-01-05')
  })
})

// ---------- Trip splits ----------

describe('tripSettlement', () => {
  it('splits the total equally and settles who owes whom', () => {
    const s = tripSettlement(['A', 'B', 'C'], [
      { actual: 9000, paidBy: 'A' },
      { actual: 3000, paidBy: 'B' },
    ])
    expect(s.total).toBe(12000)
    expect(s.share).toBe(4000)
    expect(s.balances).toEqual([
      { name: 'A', paid: 9000, balance: 5000 },
      { name: 'B', paid: 3000, balance: -1000 },
      { name: 'C', paid: 0, balance: -4000 },
    ])
    expect(s.transfers).toEqual([
      { from: 'B', to: 'A', amount: 1000 },
      { from: 'C', to: 'A', amount: 4000 },
    ])
  })

  it('needs no transfers when everyone paid their share', () => {
    const s = tripSettlement(['A', 'B'], [{ actual: 500, paidBy: 'A' }, { actual: 500, paidBy: 'B' }])
    expect(s.transfers).toEqual([])
  })

  it('counts unassigned items in the total but not in anyone\'s payments', () => {
    const s = tripSettlement(['A', 'B'], [{ actual: 1000, paidBy: 'A' }, { actual: 1000 }])
    expect(s.share).toBe(1000)
    expect(s.balances.map(b => b.balance)).toEqual([0, -1000])
    expect(s.transfers).toEqual([])
  })

  it('handles an uneven split with several creditors', () => {
    const s = tripSettlement(['A', 'B', 'C', 'D'], [
      { actual: 700, paidBy: 'A' },
      { actual: 500, paidBy: 'B' },
    ])
    // share 300: A +400, B +200, C -300, D -300
    expect(s.transfers).toEqual([
      { from: 'C', to: 'A', amount: 300 },
      { from: 'D', to: 'A', amount: 100 },
      { from: 'D', to: 'B', amount: 200 },
    ])
    const moved = s.transfers.reduce((t, x) => t + x.amount, 0)
    expect(moved).toBe(600)
  })

  it('ignores rounding dust under half a rupee', () => {
    const s = tripSettlement(['A', 'B', 'C'], [{ actual: 100, paidBy: 'A' }])
    // share 33.33…: transfers of 33.33 each, no leftover third transfer
    expect(s.transfers).toHaveLength(2)
    for (const t of s.transfers) expect(t.amount).toBeCloseTo(33.333, 2)
  })

  it('returns no share with no travelers', () => {
    expect(tripSettlement([], [{ actual: 100 }])).toEqual({ total: 100, share: 0, balances: [], transfers: [] })
  })
})

// ---------- Needs / wants / investments ----------

describe('bucketTotals', () => {
  it('sums expenses and your EMI share into buckets', () => {
    const data = makeData({
      expenses: [
        makeExpense({ id: '1', category: 'Groceries', amount: 4000, date: '2026-03-02' }),
        makeExpense({ id: '2', category: 'Shopping', amount: 2000, date: '2026-03-03' }),
        makeExpense({ id: '3', category: 'Shopping', amount: 1500, date: '2026-03-04', bucket: 'needs' }),
        makeExpense({ id: '4', category: 'SIP & Mutual Funds', amount: 5000, date: '2026-01-01', recurring: true }),
        makeExpense({ id: '5', category: 'Groceries', amount: 999, date: '2026-02-01' }), // other month
      ],
      emis: [makeEmi({ principal: 60000, rate: 0, tenure: 6, shares: [{ memberId: 'mom', percent: 50 }] })],
    })
    expect(bucketTotals(data, '2026-03')).toEqual({ needs: 4000 + 1500 + 5000, wants: 2000, invest: 5000, emi: 5000 })
  })
})

// ---------- Paid / still to pay ----------

describe('isPaid and dueDate', () => {
  it('treats one-off expenses as paid unless marked otherwise', () => {
    expect(isPaid(makeExpense(), '2026-03')).toBe(true)
    expect(isPaid(makeExpense({ paid: false }), '2026-03')).toBe(false)
  })

  it('ticks monthly items per month and counts past months as paid', () => {
    setToday('2026-03-10')
    const bill = makeExpense({ recurring: true, paidMonths: ['2026-04'] })
    expect(isPaid(bill, '2026-02')).toBe(true)
    expect(isPaid(bill, '2026-03')).toBe(false)
    expect(isPaid(bill, '2026-04')).toBe(true)
  })

  it('puts a recurring bill on the same day each month, clamped to month end', () => {
    const bill = makeExpense({ recurring: true, date: '2026-01-31' })
    expect(dueDate(bill, '2026-02')).toBe('2026-02-28')
    expect(dueDate(bill, '2026-03')).toBe('2026-03-31')
    expect(dueDate(makeExpense({ date: '2026-01-31' }), '2026-02')).toBe('2026-01-31')
  })
})
