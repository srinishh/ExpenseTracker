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

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'income', label: 'Family Income', icon: '👨‍👩‍👧' },
  { id: 'expenses', label: 'Expenses', icon: '🧾' },
  { id: 'cards', label: 'Credit Cards', icon: '💳' },
  { id: 'trips', label: 'Trip Planner', icon: '✈️' },
  { id: 'planning', label: 'Budgets & Goals', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const

export type PageId = typeof PAGES[number]['id']

function readHash(): PageId {
  const h = window.location.hash.replace('#/', '') as PageId
  return PAGES.some(p => p.id === h) ? h : 'dashboard'
}

export default function App() {
  const { data, replace } = useStore()
  const [page, setPage] = useState<PageId>(readHash)

  useEffect(() => {
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (id: PageId) => {
    window.location.hash = `#/${id}`
    setPage(id)
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
      </aside>

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
        {page === 'cards' && <CreditCards />}
        {page === 'trips' && <Trips />}
        {page === 'planning' && <Planning />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
