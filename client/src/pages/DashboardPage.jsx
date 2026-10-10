import Icon from '../components/Icon'

function StatCard({ label, icon, tone }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span>{label}</span><span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={18} /></span></div>
      <div className="stat-value" aria-label="Statistics unavailable">—</div>
      <div className="stat-footnote">Will appear when dashboard data is connected</div>
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

export default function DashboardPage() {
  return (
    <div className="page-content">
      <section className="welcome-row">
        <div><div className="eyebrow">OVERVIEW</div><h1>Good morning <span className="wave">✦</span></h1><p>Here’s what’s happening across your team today.</p></div>
        <div className="today-chip"><Icon name="clock" size={16} /><span>Today</span><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</strong></div>
      </section>

      <section className="stats-grid" aria-label="Team summary">
        <StatCard label="Total employees" icon="users" tone="blue" />
        <StatCard label="Active employees" icon="chart" tone="green" />
        <StatCard label="Total tasks" icon="check" tone="violet" />
        <StatCard label="Overdue tasks" icon="clock" tone="orange" />
      </section>

      <section className="insights-grid" aria-label="Team insights">
        <article className="panel">
          <div className="panel-heading"><div><h2>Task status</h2><p>Current distribution across all tasks</p></div><button className="panel-menu" aria-label="Task status options">···</button></div>
          <EmptyPanel icon="chart" title="Task insights will appear here" description="Connect the dashboard data to see a breakdown of work by status." />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h2>Employee workload</h2><p>Tasks assigned across your team</p></div><button className="panel-menu" aria-label="Employee workload options">···</button></div>
          <EmptyPanel icon="users" title="Workload data is not connected yet" description="Once connected, you’ll see how tasks are distributed across employees." />
        </article>
      </section>
      <p className="data-note"><span className="status-dot" /> Dashboard statistics will appear once the dashboard API is connected.</p>
    </div>
  )
}
