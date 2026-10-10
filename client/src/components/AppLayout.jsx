import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import EmployeesPage from '../pages/EmployeesPage'
import TasksPage from '../pages/TasksPage'
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
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
        <footer className="app-footer"><span>© 2026 Roots Media</span><span>Employee &amp; Task Management</span></footer>
      </main>
    </div>
  )
}
