import { useEffect, useState } from 'react'
import { useStore } from './store'
import { emptyData } from './sample'
import Dashboard from './pages/Dashboard'
import FamilyIncome from './pages/FamilyIncome'
import Expenses from './pages/Expenses'
import CreditCards from './pages/CreditCards'
import Trips from './pages/Trips'
import Planning from './pages/Planning'
import Settings from './pages/Settings'
import Split from './pages/Split'
import { SyncBadge } from './components/SheetSync'
import { ExpenseForm, newExpense } from './pages/Expenses'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'income', label: 'Family Income', icon: '👨‍👩‍👧' },
  { id: 'expenses', label: 'Expenses', icon: '🧾' },
  { id: 'split', label: 'Needs & Wants', icon: '⚖️' },
  { id: 'cards', label: 'Credit Cards', icon: '💳' },
  { id: 'trips', label: 'Trip Planner', icon: '✈️' },
  { id: 'planning', label: 'Budgets & Goals', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const

export type PageId = typeof PAGES[number]['id']

// Phone tab bar: the four most-used pages plus "More"; the rest live in the More sheet
const TAB_PAGES: PageId[] = ['dashboard', 'expenses', 'cards']
const SHORT_LABEL: Partial<Record<PageId, string>> = { dashboard: 'Home', cards: 'Cards' }

function readHash(): PageId {
  if (window.location.hash.startsWith('#/connect')) return 'settings'
  const h = window.location.hash.replace('#/', '') as PageId
  return PAGES.some(p => p.id === h) ? h : 'dashboard'
}

export default function App() {
  const { data, replace } = useStore()
  const [page, setPage] = useState<PageId>(readHash)
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)
  const current = PAGES.find(p => p.id === page)!

  useEffect(() => {
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (id: PageId) => {
    window.location.hash = `#/${id}`
    setPage(id)
    setMoreOpen(false)
    window.scrollTo({ top: 0 })
  }

  const startFresh = () => {
    if (confirm('Clear the sample data and start with an empty tracker?')) {
      replace({ ...emptyData(), settings: data.settings })
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">💰</span>
          <div>
            <div className="brand-name">Family Finance</div>
            <div className="brand-sub">Track · Share · Plan</div>
          </div>
        </div>
        <nav className="nav">
          {PAGES.map(p => (
            <button key={p.id} className={`nav-item ${page === p.id ? 'active' : ''}`} onClick={() => go(p.id)}>
              <span className="nav-icon">{p.icon}</span>
              <span className="nav-label">{p.label}</span>
            </button>
          ))}
        </nav>
        <SyncBadge />
      </aside>

      <header className="mobile-top">
        <span className="brand-logo">💰</span>
        <b className="grow">{current.label}</b>
        <SyncBadge />
      </header>

      <main className="main">
        {data.isSample && (
          <div className="banner">
            <span>👋 You're exploring <b>sample data</b>. Play around, then start fresh with your own numbers.</span>
            <button className="btn btn-sm" onClick={startFresh}>Start fresh</button>
          </div>
        )}
        {page === 'dashboard' && <Dashboard go={go} />}
        {page === 'income' && <FamilyIncome />}
        {page === 'expenses' && <Expenses />}
        {page === 'split' && <Split />}
        {page === 'cards' && <CreditCards />}
        {page === 'trips' && <Trips />}
        {page === 'planning' && <Planning />}
        {page === 'settings' && <Settings />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TAB_PAGES.slice(0, 2).map(id => <TabButton key={id} id={id} active={page === id && !moreOpen} onClick={() => go(id)} />)}
        <button className="tab-add" onClick={() => setQuickAdd(true)} aria-label="Add expense"><span>＋</span></button>
        {TAB_PAGES.slice(2).map(id => <TabButton key={id} id={id} active={page === id && !moreOpen} onClick={() => go(id)} />)}
        <button className={`tab-btn ${moreOpen || !TAB_PAGES.includes(page) ? 'active' : ''}`} onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}>
          <span className="tab-icon">☰</span><span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="More pages">
            <div className="sheet-handle" />
            <div className="sheet-grid">
              {PAGES.filter(p => !TAB_PAGES.includes(p.id)).map(p => (
                <button key={p.id} className={`sheet-item ${page === p.id ? 'active' : ''}`} onClick={() => go(p.id)}>
                  <span className="sheet-icon">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {quickAdd && <ExpenseForm expense={newExpense()} onClose={() => setQuickAdd(false)} />}
    </div>
  )
}

function TabButton({ id, active, onClick }: { id: PageId; active: boolean; onClick: () => void }) {
  const p = PAGES.find(x => x.id === id)!
  return (
    <button className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">{p.icon}</span><span>{SHORT_LABEL[id] ?? p.label}</span>
    </button>
  )
}
