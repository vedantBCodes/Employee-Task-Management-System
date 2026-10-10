import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import EmployeeForm from '../components/EmployeeForm'
import EmployeeDetails from '../components/EmployeeDetails'
import EmployeeDeleteConfirmation from '../components/EmployeeDeleteConfirmation'
import { fetchEmployees } from '../api/employees'

const PAGE_SIZE = 10

function formatJoiningDate(value) {
  if (!value) return '—'
  const calendarDate = String(value).slice(0, 10)
  const date = new Date(`${calendarDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function EmployeeTable({ employees, onView, onEdit, onDelete }) {
  return (
    <div className="employee-table-scroll" role="region" aria-label="Employee list" tabIndex="0">
      <table className="employee-table">
        <thead>
          <tr>
            <th scope="col">Employee ID</th>
            <th scope="col">Full Name</th>
            <th scope="col">Email</th>
            <th scope="col">Phone</th>
            <th scope="col">Department</th>
            <th scope="col">Role</th>
            <th scope="col">Joining Date</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee._id}>
              <td className="employee-id-cell">{employee.employeeId}</td>
              <td className="employee-name-cell">{employee.fullName}</td>
              <td>{employee.email}</td>
              <td>{employee.phone}</td>
              <td>{employee.department}</td>
              <td>{employee.role}</td>
              <td className="date-cell">{formatJoiningDate(employee.joiningDate)}</td>
              <td><span className={`employee-status status-${employee.status?.toLowerCase().replaceAll(' ', '-')}`}>{employee.status}</span></td>
              <td><div className="employee-row-actions">
                <button type="button" className="employee-action-button" onClick={() => onView(employee)}>View</button>
                <button type="button" className="employee-action-button" onClick={() => onEdit(employee)}>Edit</button>
                <button type="button" className="employee-action-button employee-delete-action" onClick={() => onDelete(employee)}>Delete</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmployeeEmptyState() {
  return (
    <div className="employee-empty-state">
      <span className="empty-icon"><Icon name="users" size={22} /></span>
      <strong>No employees yet</strong>
      <p>Employees will appear here once they’ve been added to your workspace.</p>
    </div>
  )
}

export default function EmployeesPage() {
  const [page, setPage] = useState(1)
  const [requestKey, setRequestKey] = useState(0)
  const [formState, setFormState] = useState({ mode: null, employee: null })
  const [viewEmployee, setViewEmployee] = useState(null)
  const [deleteEmployee, setDeleteEmployee] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [result, setResult] = useState({ status: 'loading', employees: [], pagination: null, error: null })

  useEffect(() => {
    const controller = new AbortController()

    fetchEmployees({ page, limit: PAGE_SIZE, signal: controller.signal })
      .then(({ employees, pagination }) => {
        setResult({ status: 'success', employees, pagination, error: null })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          const message = error instanceof TypeError
            ? 'Could not reach the employees API. Check that the backend is running and the API URL is correct.'
            : error.message
          setResult({ status: 'error', employees: [], pagination: null, error: message })
        }
      })

    return () => controller.abort()
  }, [page, requestKey])

  const loading = result.status === 'loading'
  const failed = result.status === 'error'
  const pagination = result.pagination
  const total = pagination?.total ?? 0
  const firstItem = result.employees.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastItem = Math.min(page * PAGE_SIZE, total)

  function retry() {
    setResult({ status: 'loading', employees: [], pagination: null, error: null })
    setRequestKey((current) => current + 1)
  }

  function handleEmployeeSaved(employee, mode) {
    setFormState({ mode: null, employee: null })
    setSuccessMessage(`${employee.fullName} was ${mode === 'edit' ? 'updated' : 'added'} successfully.`)
    setPage(1)
    setRequestKey((current) => current + 1)
  }

  function handleEmployeeDeleted(employee) {
    setDeleteEmployee(null)
    setSuccessMessage(`${employee.fullName} was deleted successfully.`)
    setPage((current) => Math.min(current, Math.max(1, Math.ceil((total - 1) / PAGE_SIZE))))
    setRequestKey((current) => current + 1)
  }

  return (
    <div className="page-content employees-page">
      <section className="employees-heading">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Employees</h1>
          <p>Manage your people and keep employee information in one place.</p>
        </div>
        <button className="add-employee-button" type="button" onClick={() => setFormState({ mode: 'create', employee: null })}>
          <span aria-hidden="true">+</span> Add Employee
        </button>
      </section>

      {successMessage && <div className="employee-success" role="status"><span className="success-check">✓</span><span>{successMessage}</span><button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss success message">×</button></div>}

      {failed ? (
        <section className="employee-feedback employee-error" role="alert">
          <span className="employee-feedback-icon">!</span>
          <div><strong>Employees couldn’t be loaded.</strong><p>{result.error}</p></div>
          <button type="button" onClick={retry}>Try again</button>
        </section>
      ) : loading ? (
        <section className="employee-feedback" role="status"><span className="loading-spinner" />Loading employees…</section>
      ) : result.employees.length === 0 && total === 0 ? (
        <section className="employee-list-panel"><EmployeeEmptyState /></section>
      ) : (
        <section className="employee-list-panel">
          <div className="employee-list-toolbar">
            <div><h2>All employees</h2><p>{total.toLocaleString()} employee{total === 1 ? '' : 's'} in your workspace</p></div>
            <span className="employee-page-size">10 per page</span>
          </div>
          <EmployeeTable
            employees={result.employees}
            onView={setViewEmployee}
            onEdit={(employee) => setFormState({ mode: 'edit', employee })}
            onDelete={setDeleteEmployee}
          />
          <div className="employee-pagination">
            <span>Showing {firstItem}–{lastItem} of {total.toLocaleString()}</span>
            <div className="pagination-controls">
              <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}>Previous</button>
              <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pagination.totalPages}>Next</button>
            </div>
          </div>
        </section>
      )}
      {!loading && !failed && result.employees.length > 0 && <p className="mobile-table-hint">Scroll horizontally to view all employee details.</p>}
      {formState.mode && <EmployeeForm
        key={`${formState.mode}-${formState.employee?._id || 'new'}`}
        mode={formState.mode}
        employee={formState.employee}
        onClose={() => setFormState({ mode: null, employee: null })}
        onCreated={(employee) => handleEmployeeSaved(employee, 'create')}
        onUpdated={(employee) => handleEmployeeSaved(employee, 'edit')}
      />}
      {viewEmployee && <EmployeeDetails employee={viewEmployee} onClose={() => setViewEmployee(null)} />}
      {deleteEmployee && <EmployeeDeleteConfirmation
        employee={deleteEmployee}
        onClose={() => setDeleteEmployee(null)}
        onDeleted={handleEmployeeDeleted}
      />}
    </div>
  )
}
