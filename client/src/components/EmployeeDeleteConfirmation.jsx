import { useEffect, useState } from 'react'
import { deleteEmployee } from '../api/employees'

export default function EmployeeDeleteConfirmation({ employee, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !deleting) onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleting, onClose])

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    setError('')

    try {
      await deleteEmployee(employee._id)
      onDeleted(employee)
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Could not reach the employees API. Check that the backend is running and the API URL is correct.'
        : requestError.message)
    } finally {
      setDeleting(false)
    }
  }

  function closeFromBackdrop(event) {
    if (event.target === event.currentTarget && !deleting) onClose()
  }

  return (
    <div className="employee-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="employee-modal employee-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="employee-delete-title" aria-describedby="employee-delete-description">
        <header className="employee-modal-header">
          <div><div className="eyebrow">EMPLOYEE DIRECTORY</div><h2 id="employee-delete-title">Delete employee?</h2><p id="employee-delete-description">You’re about to delete {employee.fullName} ({employee.employeeId}).</p></div>
          <button className="employee-modal-close" type="button" aria-label="Close confirmation" onClick={onClose} disabled={deleting}>×</button>
        </header>
        <div className="employee-delete-content">
          <p>This action cannot be undone. Employees with Todo or In Progress tasks cannot be deleted.</p>
          {error && <div className="employee-form-error" role="alert"><strong>{error}</strong></div>}
        </div>
        <footer className="employee-delete-actions">
          <button type="button" className="employee-cancel-button" onClick={onClose} disabled={deleting}>Cancel</button>
          <button type="button" className="employee-delete-button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete Employee'}</button>
        </footer>
      </section>
    </div>
  )
}
