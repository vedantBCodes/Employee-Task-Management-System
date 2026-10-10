import { useEffect, useState } from 'react'
import { createTask, updateTask } from '../api/tasks'
import { fetchAllEmployees } from '../api/employees'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const INITIAL_VALUES = {
  title: '',
  description: '',
  assignedEmployee: '',
  priority: '',
  startDate: '',
  dueDate: '',
}

function getInitialValues(task) {
  if (!task) return INITIAL_VALUES
  const dateValue = (value) => value ? String(value).slice(0, 10) : ''
  return {
    title: task.title || '',
    description: task.description || '',
    assignedEmployee: task.assignedEmployee?._id || '',
    priority: task.priority || '',
    startDate: dateValue(task.startDate),
    dueDate: dateValue(task.dueDate),
  }
}

function FormField({ label, name, required = false, error, children, className = '' }) {
  return (
    <div className={`employee-form-field task-form-field ${className}`}>
      <label htmlFor={name}>{label}{required && <span className="required-mark"> *</span>}</label>
      {children}
      {error && <span className="field-error" id={`${name}-error`}>{error}</span>}
    </div>
  )
}

function validate(values, employees) {
  const errors = {}
  const requiredFields = {
    title: 'Title',
    description: 'Description',
    assignedEmployee: 'Assigned employee',
    priority: 'Priority',
    startDate: 'Start date',
    dueDate: 'Due date',
  }

  for (const [field, label] of Object.entries(requiredFields)) {
    if (!values[field].trim()) errors[field] = `${label} is required.`
  }

  if (values.assignedEmployee && !employees.some((employee) => employee._id === values.assignedEmployee)) {
    errors.assignedEmployee = 'Select an employee from the list.'
  }
  if (values.priority && !PRIORITIES.includes(values.priority)) {
    errors.priority = 'Select a valid priority.'
  }
  if (values.startDate && values.dueDate && values.dueDate < values.startDate) {
    errors.dueDate = 'Due date must be on or after the start date.'
  }

  return errors
}

export default function TaskForm({ mode = 'create', task = null, onClose, onCreated, onUpdated }) {
  const editing = mode === 'edit'
  const [values, setValues] = useState(() => getInitialValues(task))
  const [employees, setEmployees] = useState([])
  const [employeeLoad, setEmployeeLoad] = useState({ status: 'loading', error: '' })
  const [employeeRequestKey, setEmployeeRequestKey] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchAllEmployees({ signal: controller.signal })
      .then((result) => {
        setEmployees(result)
        setEmployeeLoad({ status: 'success', error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setEmployeeLoad({
            status: 'error',
            error: error instanceof TypeError
              ? 'Could not reach the employees API. Check that the backend is running and the API URL is correct.'
              : error.message,
          })
        }
      })

    return () => controller.abort()
  }, [employeeRequestKey])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !submitting) onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, submitting])

  const selectedEmployee = employees.find((employee) => employee._id === values.assignedEmployee)

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    if (submitting) return
    if (editing && ['Completed', 'Cancelled'].includes(task.status)) {
      setFormError(`${task.status} tasks cannot be edited.`)
      return
    }

    const errors = validate(values, employees)
    setFieldErrors(errors)
    setFormError('')
    if (employeeLoad.status !== 'success') {
      setFormError('Load the employee list before creating a task.')
      return
    }
    if (Object.keys(errors).length > 0) {
      setFormError('Review the highlighted fields and try again.')
      return
    }

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      assignedEmployee: selectedEmployee._id,
      department: selectedEmployee.department,
      priority: values.priority,
      startDate: values.startDate,
      dueDate: values.dueDate,
    }

    setSubmitting(true)
    try {
      const savedTask = editing
        ? await updateTask(task._id, payload)
        : await createTask(payload)
      setValues(INITIAL_VALUES)
      if (editing) onUpdated(savedTask)
      else onCreated(savedTask)
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Could not reach the tasks API. Check that the backend is running and the API URL is correct.'
        : error.message
      setFormError(message)

      if (error.details?.length) {
        const backendErrors = Object.fromEntries(error.details.map(({ path, message: detail }) => [path, detail]))
        setFieldErrors((current) => ({ ...current, ...backendErrors }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  function closeFromBackdrop(event) {
    if (event.target === event.currentTarget && !submitting) onClose()
  }

  function retryEmployees() {
    setEmployeeLoad({ status: 'loading', error: '' })
    setEmployeeRequestKey((current) => current + 1)
  }

  return (
    <div className="employee-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="employee-modal task-form-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <header className="employee-modal-header">
          <div><div className="eyebrow">TASK MANAGEMENT</div><h2 id="task-form-title">{editing ? 'Edit task' : 'Add task'}</h2><p>{editing ? 'Update the task details below.' : 'Enter task details and choose an eligible employee.'}</p></div>
          <button className="employee-modal-close" type="button" aria-label="Close task form" onClick={onClose} disabled={submitting}>×</button>
        </header>

        <form className="employee-form task-form" onSubmit={submitForm} noValidate>
          {formError && <div className="employee-form-error" role="alert"><strong>{formError}</strong></div>}
          {employeeLoad.status === 'error' && <div className="task-employee-load-error" role="alert"><span>{employeeLoad.error}</span><button type="button" onClick={retryEmployees}>Retry</button></div>}

          <div className="employee-form-grid task-form-grid">
            <FormField label="Title" name="title" required error={fieldErrors.title}>
              <input id="title" name="title" value={values.title} onChange={updateField} autoFocus aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'title-error' : undefined} />
            </FormField>
            <FormField label="Assigned Employee" name="assignedEmployee" required error={fieldErrors.assignedEmployee}>
              <select id="assignedEmployee" name="assignedEmployee" value={values.assignedEmployee} onChange={updateField} disabled={employeeLoad.status !== 'success' || employees.length === 0} aria-invalid={Boolean(fieldErrors.assignedEmployee)} aria-describedby={fieldErrors.assignedEmployee ? 'assignedEmployee-error' : undefined}>
                <option value="">{employeeLoad.status === 'loading' ? 'Loading employees…' : employees.length ? 'Select employee' : employeeLoad.status === 'error' ? 'Employees unavailable' : 'No employees available'}</option>
                {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} ({employee.employeeId})</option>)}
              </select>
            </FormField>
            <FormField label="Priority" name="priority" required error={fieldErrors.priority}>
              <select id="priority" name="priority" value={values.priority} onChange={updateField} aria-invalid={Boolean(fieldErrors.priority)} aria-describedby={fieldErrors.priority ? 'priority-error' : undefined}>
                <option value="">Select priority</option>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </FormField>
            <FormField label="Department" name="department">
              <input id="department" value={selectedEmployee?.department || ''} readOnly placeholder="Selected employee’s department" aria-label="Department from assigned employee" />
            </FormField>
            <FormField label="Start Date" name="startDate" required error={fieldErrors.startDate}>
              <input id="startDate" name="startDate" type="date" value={values.startDate} onChange={updateField} aria-invalid={Boolean(fieldErrors.startDate)} aria-describedby={fieldErrors.startDate ? 'startDate-error' : undefined} />
            </FormField>
            <FormField label="Due Date" name="dueDate" required error={fieldErrors.dueDate}>
              <input id="dueDate" name="dueDate" type="date" min={values.startDate || undefined} value={values.dueDate} onChange={updateField} aria-invalid={Boolean(fieldErrors.dueDate)} aria-describedby={fieldErrors.dueDate ? 'dueDate-error' : undefined} />
            </FormField>
            <FormField label="Description" name="description" required error={fieldErrors.description} className="task-description-field">
              <textarea id="description" name="description" rows="4" value={values.description} onChange={updateField} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'description-error' : undefined} />
            </FormField>
          </div>

          <footer className="employee-form-actions">
            <button type="button" className="employee-cancel-button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="employee-submit-button" disabled={submitting || employeeLoad.status !== 'success' || employees.length === 0 || (editing && ['Completed', 'Cancelled'].includes(task.status))}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Task'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
