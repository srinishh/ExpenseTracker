export type ID = string

export interface Member {
  id: ID
  name: string
  relation: string
  color: string
  isSelf?: boolean
}

export interface Income {
  id: ID
  memberId: ID
  source: string
  category: string
  amount: number
  date: string // YYYY-MM-DD
  recurring: boolean // counts every month from `date` onwards
  note?: string
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank'

export interface Expense {
  id: ID
  description: string
  category: string
  amount: number
  date: string
  memberId?: ID
  method: PaymentMethod
  cardId?: ID
  billed?: boolean // only meaningful for card spends; false = unbilled
  recurring?: boolean
}

export interface CreditCard {
  id: ID
  name: string
  bank: string
  last4: string
  limit: number
  billingDay: number // statement generation day of month
  dueDay: number // payment due day of month
  color: string
  billedOutstanding: number // current statement amount still to pay
}

export interface EmiShare {
  memberId: ID
  percent: number // share of the monthly EMI this member owes
}

export interface Emi {
  id: ID
  title: string
  cardId?: ID // optional: EMI on a credit card, otherwise loan/bank
  principal: number
  rate: number // annual interest %
  tenure: number // months
  startDate: string // first instalment date
  processingFee?: number
  shares: EmiShare[]
  // ym -> member ids that have paid back their share for that month
  settlements: Record<string, ID[]>
}

export interface TripItem {
  id: ID
  category: string
  title: string
  planned: number
  actual: number
  paidBy?: string // traveler name
}

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export interface Trip {
  id: ID
  name: string
  destination: string
  startDate: string
  endDate: string
  budget: number
  travelers: string[]
  emoji: string
  items: TripItem[]
  checklist: ChecklistItem[]
  notes?: string
}

export interface Goal {
  id: ID
  name: string
  target: number
  saved: number
  deadline?: string
  emoji: string
}

export interface Settings {
  currency: string
  theme: 'system' | 'light' | 'dark'
}

export interface AppData {
  version: number
  isSample: boolean
  members: Member[]
  incomes: Income[]
  expenses: Expense[]
  cards: CreditCard[]
  emis: Emi[]
  trips: Trip[]
  goals: Goal[]
  budgets: Record<string, number>
  settings: Settings
}
