import { useEffect } from 'react'

function formatDate(value) {
  if (!value) return '—'
  const calendarDate = String(value).slice(0, 10)
  const date = new Date(`${calendarDate}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Detail({ label, children }) {
  return <div className="task-detail"><span>{label}</span><strong>{children || '—'}</strong></div>
}

export default function TaskDetails({ task, onClose }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function closeFromBackdrop(event) {
    if (event.target === event.currentTarget) onClose()
  }

  const employee = task.assignedEmployee

  return (
    <div className="employee-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="employee-modal task-details-modal" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <header className="employee-modal-header">
          <div><div className="eyebrow">TASK MANAGEMENT</div><h2 id="task-details-title">Task details</h2><p>{task.title}</p></div>
          <button className="employee-modal-close" type="button" aria-label="Close task details" onClick={onClose}>×</button>
        </header>
        <div className="task-details-content">
          <div className="task-details-grid">
            <Detail label="Task ID">{task.taskId}</Detail>
            <Detail label="Title">{task.title}</Detail>
            <Detail label="Assigned Employee">{employee?.fullName || 'Employee unavailable'}{employee?.employeeId ? ` (${employee.employeeId})` : ''}</Detail>
            <Detail label="Department">{task.department}</Detail>
            <Detail label="Priority"><span className={`task-priority priority-${task.priority?.toLowerCase()}`}>{task.priority}</span></Detail>
            <Detail label="Status"><span className={`task-status task-status-${task.status?.toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span></Detail>
            <Detail label="Start Date">{formatDate(task.startDate)}</Detail>
            <Detail label="Due Date">{formatDate(task.dueDate)}</Detail>
            <Detail label="Overdue">{task.isOverdue ? <span className="task-overdue-badge">Overdue</span> : 'No'}</Detail>
            <Detail label="Created">{formatDateTime(task.createdAt)}</Detail>
            {task.completedAt && <Detail label="Completed">{formatDateTime(task.completedAt)}</Detail>}
            <div className="task-detail task-detail-description"><span>Description</span><p>{task.description || '—'}</p></div>
          </div>
        </div>
        <footer className="task-details-actions"><button type="button" className="employee-cancel-button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  )
}
