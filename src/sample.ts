import type { AppData, Expense } from './types'
import { addMonths, currentYM, todayISO, uid } from './utils'

export function emptyData(): AppData {
  return {
    version: 1,
    isSample: false,
    members: [{ id: 'self', name: 'Me', relation: 'Self', color: '#6366f1', isSelf: true }],
    incomes: [],
    expenses: [],
    cards: [],
    emis: [],
    trips: [],
    goals: [],
    budgets: {},
    settings: { currency: 'INR', theme: 'system' },
  }
}

/** Realistic demo data, dated relative to today so the dashboard always has something to show. */
export function sampleData(): AppData {
  const ym = currentYM()
  const m = (offset: number, day: number) => `${addMonths(ym, offset)}-${String(day).padStart(2, '0')}`
  const today = todayISO()
  const day = Number(today.slice(8))

  const members = [
    { id: 'self', name: 'Me', relation: 'Self', color: '#6366f1', isSelf: true },
    { id: 'spouse', name: 'Priya', relation: 'Spouse', color: '#ec4899' },
    { id: 'dad', name: 'Dad', relation: 'Father', color: '#10b981' },
    { id: 'bro', name: 'Arjun', relation: 'Brother', color: '#f59e0b' },
  ]

  const incomes = [
    { id: uid(), memberId: 'self', source: 'Acme Corp', category: 'Salary', amount: 145000, date: m(-11, 1), recurring: true },
    { id: uid(), memberId: 'spouse', source: 'Design Studio', category: 'Salary', amount: 95000, date: m(-11, 1), recurring: true },
    { id: uid(), memberId: 'spouse', source: 'Freelance logo project', category: 'Freelance', amount: 22000, date: m(-1, 18), recurring: false },
    { id: uid(), memberId: 'dad', source: 'Pension', category: 'Pension', amount: 38000, date: m(-11, 5), recurring: true },
    { id: uid(), memberId: 'dad', source: 'Flat rent – Block B', category: 'Rental', amount: 18000, date: m(-11, 7), recurring: true },
    { id: uid(), memberId: 'bro', source: 'Internship stipend', category: 'Salary', amount: 25000, date: m(-3, 1), recurring: true },
    { id: uid(), memberId: 'self', source: 'Diwali bonus', category: 'Bonus', amount: 60000, date: m(0, Math.min(day, 10)), recurring: false },
    { id: uid(), memberId: 'self', source: 'FD interest', category: 'Interest & Dividends', amount: 4200, date: m(-2, 28), recurring: false },
  ]

  const cards = [
    { id: 'hdfc', name: 'Regalia', bank: 'HDFC', last4: '4521', limit: 400000, billingDay: 12, dueDay: 2, color: '#1e3a8a', billedOutstanding: 18450 },
    { id: 'icici', name: 'Amazon Pay', bank: 'ICICI', last4: '8890', limit: 250000, billingDay: 20, dueDay: 8, color: '#b45309', billedOutstanding: 6200 },
    { id: 'axis', name: 'Ace', bank: 'Axis', last4: '1043', limit: 150000, billingDay: 5, dueDay: 25, color: '#7e22ce', billedOutstanding: 0 },
  ]

  const expenses: Expense[] = []
  const add = (offset: number, d: number, description: string, category: string, amount: number, extra: Partial<Expense> = {}) => {
    const date = m(offset, offset === 0 ? Math.min(d, day) : d)
    expenses.push({ id: uid(), description, category, amount, date, method: 'upi', memberId: 'self', billed: offset !== 0, ...extra })
  }
  // Recurring monthly costs
  expenses.push({ id: uid(), description: 'House rent', category: 'Rent & Housing', amount: 42000, date: m(-11, 3), method: 'bank', recurring: true })
  expenses.push({ id: uid(), description: 'Netflix + Spotify', category: 'Subscriptions', amount: 848, date: m(-11, 9), method: 'card', cardId: 'axis', billed: true, recurring: true })
  expenses.push({ id: uid(), description: 'Nifty 50 index fund SIP', category: 'SIP & Mutual Funds', amount: 15000, date: m(-11, 5), method: 'bank', recurring: true })
  expenses.push({ id: uid(), description: 'PPF contribution', category: 'PPF / NPS / EPF', amount: 5000, date: m(-11, 10), method: 'bank', recurring: true })
  expenses.push({ id: uid(), description: 'Bought HDFC Bank shares', category: 'Stocks', amount: 12000, date: m(-1, 16), method: 'bank' })
  expenses.push({ id: uid(), description: 'Digital gold', category: 'Gold', amount: 3000, date: m(0, Math.min(day, 6)), method: 'upi' })
  expenses.push({ id: uid(), description: 'Term + health insurance', category: 'Insurance', amount: 4200, date: m(-11, 15), method: 'bank', recurring: true })
  // Variable spends for the last 6 months
  const pattern: [number, string, string, number, Partial<Expense>?][] = [
    [4, 'BigBasket order', 'Groceries', 6800, { method: 'card', cardId: 'icici' }],
    [7, 'Electricity + water', 'Utilities', 3400],
    [10, 'Petrol', 'Fuel', 4200, { method: 'card', cardId: 'hdfc' }],
    [12, 'Dinner at Toit', 'Food & Dining', 3800, { method: 'card', cardId: 'hdfc' }],
    [14, 'Swiggy & Zomato', 'Food & Dining', 4100],
    [17, 'Myntra haul', 'Shopping', 7200, { method: 'card', cardId: 'icici' }],
    [19, 'DMart groceries', 'Groceries', 5400],
    [21, 'Movie night', 'Entertainment', 1600, { method: 'card', cardId: 'axis' }],
    [23, 'Pharmacy & checkup', 'Health', 2600, { memberId: 'dad' }],
    [25, 'Uber rides', 'Transport', 2300],
    [27, 'Arjun college fees', 'Education', 9000, { memberId: 'bro', method: 'bank' }],
  ]
  for (let o = -5; o <= 0; o++) {
    for (const [d, desc, cat, amt, extra] of pattern) {
      if (o === 0 && d > day) continue
      const wobble = 0.8 + ((d * 7 + o * 13 + 100) % 9) / 20
      add(o, d, desc, cat, Math.round(amt * wobble / 10) * 10, extra)
    }
  }
  add(-2, 20, 'Wedding gift', 'Gifts & Donations', 11000)
  add(0, 2, 'Diwali shopping', 'Shopping', 18500, { method: 'card', cardId: 'hdfc' })
  add(0, 3, 'Sweets & decor', 'Gifts & Donations', 4800, { method: 'card', cardId: 'hdfc' })
  for (const e of expenses) if (e.method !== 'card') { delete e.billed; delete e.cardId }

  const emis = [
    {
      id: uid(), title: 'iPhone 16 Pro', cardId: 'hdfc', principal: 134900, rate: 0, tenure: 12, startDate: m(-4, 12),
      processingFee: 199, shares: [], settlements: {},
    },
    {
      id: uid(), title: 'Parents’ new fridge + AC', cardId: 'icici', principal: 96000, rate: 14, tenure: 9, startDate: m(-3, 20),
      processingFee: 299,
      shares: [{ memberId: 'bro', percent: 50 }],
      settlements: { [addMonths(ym, -3)]: ['bro'], [addMonths(ym, -2)]: ['bro'] },
    },
    {
      id: uid(), title: 'Car loan – Creta', principal: 900000, rate: 8.9, tenure: 60, startDate: m(-14, 5),
      shares: [{ memberId: 'spouse', percent: 40 }],
      settlements: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [addMonths(ym, -14 + i), ['spouse']])),
    },
  ]

  const trips = [
    {
      id: uid(), name: 'Bali Anniversary', destination: 'Bali, Indonesia', emoji: '🏝️',
      startDate: m(2, 14), endDate: m(2, 21), budget: 250000, travelers: ['Me', 'Priya'],
      items: [
        { id: uid(), category: 'Flights', title: 'BLR → DPS return', planned: 68000, actual: 64200, paidBy: 'Me' },
        { id: uid(), category: 'Stay', title: 'Ubud villa (3N)', planned: 45000, actual: 42000, paidBy: 'Priya' },
        { id: uid(), category: 'Stay', title: 'Seminyak resort (4N)', planned: 60000, actual: 0 },
        { id: uid(), category: 'Visa & Docs', title: 'Visa on arrival', planned: 7000, actual: 0 },
        { id: uid(), category: 'Activities', title: 'Nusa Penida day trip', planned: 14000, actual: 0 },
        { id: uid(), category: 'Food', title: 'Food & cafés', planned: 30000, actual: 0 },
        { id: uid(), category: 'Insurance', title: 'Travel insurance', planned: 2400, actual: 2400, paidBy: 'Me' },
      ],
      checklist: [
        { id: uid(), text: 'Passports valid 6+ months', done: true },
        { id: uid(), text: 'Book flights', done: true },
        { id: uid(), text: 'Forex card loaded', done: false },
        { id: uid(), text: 'Book airport transfer', done: false },
        { id: uid(), text: 'Pack sunscreen & adapters', done: false },
      ],
    },
    {
      id: uid(), name: 'Coorg Family Weekend', destination: 'Coorg, Karnataka', emoji: '⛰️',
      startDate: m(-1, 8), endDate: m(-1, 10), budget: 40000, travelers: ['Me', 'Priya', 'Dad', 'Arjun'],
      items: [
        { id: uid(), category: 'Stay', title: 'Homestay (2N)', planned: 16000, actual: 17500, paidBy: 'Me' },
        { id: uid(), category: 'Local Transport', title: 'Fuel + tolls', planned: 5000, actual: 4600, paidBy: 'Arjun' },
        { id: uid(), category: 'Food', title: 'Meals', planned: 10000, actual: 11200, paidBy: 'Priya' },
        { id: uid(), category: 'Activities', title: 'Coffee estate tour', planned: 4000, actual: 3200, paidBy: 'Dad' },
      ],
      checklist: [{ id: uid(), text: 'Book homestay', done: true }],
    },
  ]

  const goals = [
    { id: uid(), name: 'Emergency fund', target: 600000, saved: 410000, emoji: '🛟' },
    { id: uid(), name: 'House down payment', target: 2500000, saved: 780000, deadline: m(30, 1), emoji: '🏡' },
    { id: uid(), name: 'Bali trip', target: 250000, saved: 140000, deadline: m(2, 1), emoji: '🏝️' },
  ]

  const budgets = {
    'Food & Dining': 8000, Groceries: 12000, Shopping: 15000, Fuel: 5000,
    Entertainment: 2500, Transport: 3000, Utilities: 4000,
  }

  return {
    version: 1, isSample: true, members, incomes, expenses, cards, emis, trips, goals, budgets,
    settings: { currency: 'INR', theme: 'system' },
  }
}
