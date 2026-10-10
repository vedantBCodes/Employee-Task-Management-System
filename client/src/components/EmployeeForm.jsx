import { useEffect, useState } from 'react'
import { createEmployee, updateEmployee } from '../api/employees'

const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales']
const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Leave']

const INITIAL_VALUES = {
  employeeId: '',
  fullName: '',
  email: '',
  phone: '',
  department: '',
  role: '',
  joiningDate: '',
  status: 'Active',
  leaveStart: '',
  leaveEnd: '',
  skills: '',
}

function FormField({ label, name, required = false, error, children }) {
  return (
    <div className="employee-form-field">
      <label htmlFor={name}>{label}{required && <span className="required-mark"> *</span>}</label>
      {children}
      {error && <span className="field-error" id={`${name}-error`}>{error}</span>}
    </div>
  )
}

function validate(values) {
  const errors = {}
  const requiredFields = {
    employeeId: 'Employee ID',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    role: 'Role',
    joiningDate: 'Joining Date',
    status: 'Status',
  }

  Object.entries(requiredFields).forEach(([field, label]) => {
    if (!values[field].trim()) errors[field] = `${label} is required.`
  })

  const emailPattern = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?\.)+[A-Z]{2,}$/i
  if (values.email.trim() && !emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  const normalizedPhone = values.phone.trim().replace(/[\s-]/g, '')
  if (values.phone.trim() && !/^(?:\+91)?[6-9]\d{9}$/.test(normalizedPhone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number, optionally prefixed with +91.'
  }

  if (values.status === 'On Leave') {
    if (!values.leaveStart) errors.leaveStart = 'Leave start date is required when status is On Leave.'
    if (!values.leaveEnd) errors.leaveEnd = 'Leave end date is required when status is On Leave.'
    if (values.leaveStart && values.leaveEnd && values.leaveEnd < values.leaveStart) {
      errors.leaveEnd = 'Leave end date must be on or after the leave start date.'
    }
  }

  return errors
}

function getInitialValues(employee) {
  if (!employee) return INITIAL_VALUES

  const dateValue = (value) => value ? String(value).slice(0, 10) : ''
  return {
    employeeId: employee.employeeId || '',
    fullName: employee.fullName || '',
    email: employee.email || '',
    phone: employee.phone || '',
    department: employee.department || '',
    role: employee.role || '',
    joiningDate: dateValue(employee.joiningDate),
    status: employee.status || 'Active',
    leaveStart: dateValue(employee.leaveStart),
    leaveEnd: dateValue(employee.leaveEnd),
    skills: Array.isArray(employee.skills) ? employee.skills.join(', ') : '',
  }
}

export default function EmployeeForm({ mode = 'create', employee = null, onClose, onCreated, onUpdated }) {
  const editing = mode === 'edit'
  const [values, setValues] = useState(() => getInitialValues(employee))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !submitting) onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, submitting])

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    if (submitting) return

    const errors = validate(values)
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) {
      setFormError('Review the highlighted fields and try again.')
      return
    }

    const payload = {
      employeeId: values.employeeId.trim(),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      department: values.department,
      role: values.role.trim(),
      joiningDate: values.joiningDate,
      status: values.status,
      skills: values.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    }

    if (values.status === 'On Leave') {
      payload.leaveStart = values.leaveStart
      payload.leaveEnd = values.leaveEnd
    }

    setSubmitting(true)
    try {
      const savedEmployee = editing
        ? await updateEmployee(employee._id, payload)
        : await createEmployee(payload)
      setValues(INITIAL_VALUES)
      if (editing) onUpdated(savedEmployee)
      else onCreated(savedEmployee)
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Could not reach the employees API. Check that the backend is running and the API URL is correct.'
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

  return (
    <div className="employee-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section className="employee-modal" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <header className="employee-modal-header">
          <div><div className="eyebrow">EMPLOYEE DIRECTORY</div><h2 id="employee-form-title">{editing ? 'Edit employee' : 'Add employee'}</h2><p>{editing ? 'Update the employee details below.' : 'Enter the employee details below.'}</p></div>
          <button className="employee-modal-close" type="button" aria-label="Close form" onClick={onClose} disabled={submitting}>×</button>
        </header>

        <form className="employee-form" onSubmit={submitForm} noValidate>
          {formError && <div className="employee-form-error" role="alert"><strong>{formError}</strong></div>}

          <div className="employee-form-grid">
            <FormField label="Employee ID" name="employeeId" required error={fieldErrors.employeeId}>
              <input id="employeeId" name="employeeId" value={values.employeeId} onChange={updateField} autoFocus autoComplete="off" aria-invalid={Boolean(fieldErrors.employeeId)} aria-describedby={fieldErrors.employeeId ? 'employeeId-error' : undefined} />
            </FormField>
            <FormField label="Full Name" name="fullName" required error={fieldErrors.fullName}>
              <input id="fullName" name="fullName" value={values.fullName} onChange={updateField} autoComplete="name" aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined} />
            </FormField>
            <FormField label="Email" name="email" required error={fieldErrors.email}>
              <input id="email" name="email" type="email" value={values.email} onChange={updateField} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
            </FormField>
            <FormField label="Phone" name="phone" required error={fieldErrors.phone}>
              <input id="phone" name="phone" type="tel" inputMode="tel" value={values.phone} onChange={updateField} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} />
            </FormField>
            <FormField label="Department" name="department" required error={fieldErrors.department}>
              <select id="department" name="department" value={values.department} onChange={updateField} aria-invalid={Boolean(fieldErrors.department)} aria-describedby={fieldErrors.department ? 'department-error' : undefined}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </FormField>
            <FormField label="Role" name="role" required error={fieldErrors.role}>
              <input id="role" name="role" value={values.role} onChange={updateField} aria-invalid={Boolean(fieldErrors.role)} aria-describedby={fieldErrors.role ? 'role-error' : undefined} />
            </FormField>
            <FormField label="Joining Date" name="joiningDate" required error={fieldErrors.joiningDate}>
              <input id="joiningDate" name="joiningDate" type="date" value={values.joiningDate} onChange={updateField} aria-invalid={Boolean(fieldErrors.joiningDate)} aria-describedby={fieldErrors.joiningDate ? 'joiningDate-error' : undefined} />
            </FormField>
            <FormField label="Status" name="status" required error={fieldErrors.status}>
              <select id="status" name="status" value={values.status} onChange={updateField} aria-invalid={Boolean(fieldErrors.status)} aria-describedby={fieldErrors.status ? 'status-error' : undefined}>
                {EMPLOYEE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </FormField>

            {values.status === 'On Leave' && (
              <>
                <FormField label="Leave Start Date" name="leaveStart" required error={fieldErrors.leaveStart}>
                  <input id="leaveStart" name="leaveStart" type="date" value={values.leaveStart} onChange={updateField} aria-invalid={Boolean(fieldErrors.leaveStart)} aria-describedby={fieldErrors.leaveStart ? 'leaveStart-error' : undefined} />
                </FormField>
                <FormField label="Leave End Date" name="leaveEnd" required error={fieldErrors.leaveEnd}>
                  <input id="leaveEnd" name="leaveEnd" type="date" value={values.leaveEnd} onChange={updateField} aria-invalid={Boolean(fieldErrors.leaveEnd)} aria-describedby={fieldErrors.leaveEnd ? 'leaveEnd-error' : undefined} />
                </FormField>
              </>
            )}

            <FormField label="Skills" name="skills" error={fieldErrors.skills}>
              <input id="skills" name="skills" value={values.skills} onChange={updateField} placeholder="e.g. React, Node.js, MongoDB" aria-describedby="skills-hint" />
              <small className="form-field-hint" id="skills-hint">Separate skills with commas.</small>
            </FormField>
          </div>

          <footer className="employee-form-actions">
            <button type="button" className="employee-cancel-button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="employee-submit-button" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Save Employee'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
