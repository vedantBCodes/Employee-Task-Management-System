import { useEffect } from 'react'

function formatDate(value) {
  if (!value) return '—'
  const dateValue = String(value).slice(0, 10)
  const date = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function Detail({ label, value }) {
  return <div className="employee-detail"><span>{label}</span><strong>{value || '—'}</strong></div>
}

export default function EmployeeDetails({ employee, onClose }) {
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

  return (
    <div className="employee-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="employee-modal employee-details-modal" role="dialog" aria-modal="true" aria-labelledby="employee-details-title">
        <header className="employee-modal-header">
          <div><div className="eyebrow">EMPLOYEE DIRECTORY</div><h2 id="employee-details-title">Employee details</h2><p>Complete profile for {employee.fullName}.</p></div>
          <button className="employee-modal-close" type="button" aria-label="Close employee details" onClick={onClose}>×</button>
        </header>
        <div className="employee-details-content">
          <div className="employee-details-grid">
            <Detail label="Employee ID" value={employee.employeeId} />
            <Detail label="Full Name" value={employee.fullName} />
            <Detail label="Email" value={employee.email} />
            <Detail label="Phone" value={employee.phone} />
            <Detail label="Department" value={employee.department} />
            <Detail label="Role" value={employee.role} />
            <Detail label="Joining Date" value={formatDate(employee.joiningDate)} />
            <div className="employee-detail"><span>Status</span><strong><span className={`employee-status status-${employee.status?.toLowerCase().replaceAll(' ', '-')}`}>{employee.status}</span></strong></div>
            {employee.status === 'On Leave' && <>
              <Detail label="Leave Start Date" value={formatDate(employee.leaveStart)} />
              <Detail label="Leave End Date" value={formatDate(employee.leaveEnd)} />
            </>}
            <div className="employee-detail employee-detail-skills"><span>Skills</span><strong>{Array.isArray(employee.skills) && employee.skills.length ? employee.skills.join(', ') : 'No skills listed'}</strong></div>
          </div>
        </div>
        <footer className="employee-details-actions"><button type="button" className="employee-cancel-button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  )
}
