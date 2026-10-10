import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { fetchDashboardStats } from '../api/dashboard'

const STATUS_ITEMS = [
  { label: 'Todo', color: 'todo' },
  { label: 'In Progress', color: 'progress' },
  { label: 'Completed', color: 'completed' },
  { label: 'Cancelled', color: 'cancelled' },
]

function StatCard({ label, value, icon, tone, loading, unavailable }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span>{label}</span><span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={18} /></span></div>
      <div className="stat-value" aria-label={loading ? 'Loading' : unavailable ? 'Unavailable' : `${value}`}>{loading || unavailable ? '—' : value.toLocaleString()}</div>
      <div className="stat-footnote">{loading ? 'Loading dashboard data…' : unavailable ? 'Statistics are unavailable' : 'Live dashboard total'}</div>
    </article>
  )
}

function EmptyPanel({ icon, title, description }) {
  return (
    <div className="panel-empty">
      <span className="empty-icon"><Icon name={icon} size={21} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function LoadingPanel({ label }) {
  return <div className="panel-message" role="status">Loading {label}…</div>
}

function TaskStatusPanel({ counts, loading, unavailable }) {
  const total = STATUS_ITEMS.reduce((sum, item) => sum + counts[item.label], 0)

  return (
    <article className="panel">
      <div className="panel-heading"><div><h2>Task status</h2><p>Current distribution across all tasks</p></div></div>
      {loading ? <LoadingPanel label="task status" /> : unavailable ? <EmptyPanel icon="chart" title="Task status is unavailable" description="Check the dashboard connection and try again." /> : total === 0 ? <EmptyPanel icon="chart" title="No tasks yet" description="Task status counts will appear here when tasks are added." /> : (
        <div className="status-list">
          {STATUS_ITEMS.map(({ label, color }) => {
            const count = counts[label]
            const percentage = Math.round((count / total) * 100)
            return (
              <div className="status-row" key={label}>
                <div className="status-row-label"><span className={`legend-dot legend-${color}`} /><span>{label}</span><strong>{count.toLocaleString()}</strong><small>{percentage}%</small></div>
                <progress className={`status-track status-progress progress-${color}`} value={count} max={total} aria-label={`${label}: ${percentage}%`} />
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function EmployeeWorkloadPanel({ employees, loading, unavailable }) {
  return (
    <article className="panel">
      <div className="panel-heading"><div><h2>Employee workload</h2><p>Todo and in-progress tasks by employee</p></div></div>
      {loading ? <LoadingPanel label="employee workload" /> : unavailable ? <EmptyPanel icon="users" title="Workload is unavailable" description="Check the dashboard connection and try again." /> : employees.length === 0 ? <EmptyPanel icon="users" title="No employees yet" description="Employee workload will appear here when employees are added." /> : (
        <div className="workload-list">
          {employees.map((employee) => (
            <div className="workload-row" key={employee._id}>
              <div className="employee-mark" aria-hidden="true">{employee.fullName?.trim()?.charAt(0)?.toUpperCase() || '?'}</div>
              <div className="employee-summary"><strong>{employee.fullName}</strong><span>{employee.employeeId} · {employee.department}</span></div>
              <div className="workload-counts" aria-label={`${employee.tasks.totalActive} active tasks`}>
                <span><b>{employee.tasks.todo}</b> todo</span>
                <span><b>{employee.tasks.inProgress}</b> in progress</span>
              </div>
              <div className="workload-total"><strong>{employee.tasks.totalActive}</strong><small>active</small></div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState({ status: 'loading', data: null, error: null })
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchDashboardStats({ signal: controller.signal })
      .then((data) => setDashboard({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          const message = error instanceof TypeError
            ? 'Could not reach the dashboard API. Check that the backend is running and the API URL is correct.'
            : error.message
          setDashboard({ status: 'error', data: null, error: message })
        }
      })

    return () => controller.abort()
  }, [requestKey])

  const loading = dashboard.status === 'loading'
  const unavailable = dashboard.status === 'error'
  const data = dashboard.data
  const taskCounts = data?.tasks?.byStatus
  const counts = Object.fromEntries(STATUS_ITEMS.map(({ label }) => [label, taskCounts?.[label] ?? 0]))

  function retryDashboard() {
    setDashboard({ status: 'loading', data: null, error: null })
    setRequestKey((current) => current + 1)
  }

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div><div className="eyebrow">OVERVIEW</div><h1>Good morning <span className="wave">✦</span></h1><p>Here’s what’s happening across your team today.</p></div>
        <div className="today-chip"><Icon name="clock" size={16} /><span>Today</span><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</strong></div>
      </section>

      {unavailable && (
        <div className="dashboard-error" role="alert">
          <div><strong>Dashboard data couldn’t be loaded.</strong><span>{dashboard.error}</span></div>
          <button type="button" onClick={retryDashboard}>Try again</button>
        </div>
      )}

      <section className="stats-grid" aria-label="Team summary" aria-busy={loading}>
        <StatCard label="Total employees" value={data?.employees.total ?? 0} icon="users" tone="blue" loading={loading} unavailable={unavailable} />
        <StatCard label="Active employees" value={data?.employees.active ?? 0} icon="chart" tone="green" loading={loading} unavailable={unavailable} />
        <StatCard label="Total tasks" value={data?.tasks.total ?? 0} icon="check" tone="violet" loading={loading} unavailable={unavailable} />
        <StatCard label="Overdue tasks" value={data?.tasks.overdue ?? 0} icon="clock" tone="orange" loading={loading} unavailable={unavailable} />
      </section>

      <section className="insights-grid" aria-label="Team insights" aria-busy={loading}>
        <TaskStatusPanel counts={counts} loading={loading} unavailable={unavailable} />
        <EmployeeWorkloadPanel employees={data?.employeeWorkload ?? []} loading={loading} unavailable={unavailable} />
      </section>
      <p className="data-note"><span className={`status-dot ${unavailable ? 'status-dot-error' : ''}`} /> {unavailable ? 'Dashboard values are hidden until the API is available.' : loading ? 'Connecting to dashboard data…' : 'Dashboard statistics are synced from the backend.'}</p>
    </div>
  )
}
