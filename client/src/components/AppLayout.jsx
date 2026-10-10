import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import PlaceholderPage from '../pages/PlaceholderPage'
import Header from './Header'
import Sidebar from './Sidebar'

const pageTitles = {
  '/': 'Dashboard',
  '/employees': 'Employees',
  '/tasks': 'Tasks',
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? 'Dashboard'

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <main className="main-area">
        <Header title={pageTitle} onMenuClick={() => setMenuOpen((open) => !open)} />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/employees" element={<PlaceholderPage title="Employees" description="Manage your people and keep employee information in one place." />} />
          <Route path="/tasks" element={<PlaceholderPage title="Tasks" description="Plan, assign, and track work across your team." />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
        <footer className="app-footer"><span>© 2026 Roots Media</span><span>Employee &amp; Task Management</span></footer>
      </main>
    </div>
  )
}
