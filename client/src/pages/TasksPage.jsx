import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import TaskForm from '../components/TaskForm'
import TaskDetails from '../components/TaskDetails'
import { exportTasksCsv, fetchTasks, updateTaskStatus } from '../api/tasks'

const PAGE_SIZE = 10
const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Todo', 'In Progress', 'Completed', 'Cancelled']
const SORT_OPTIONS = [
  ['createdAt', 'Created date'],
  ['dueDate', 'Due date'],
  ['priority', 'Priority'],
  ['title', 'Title'],
]

function buildTaskQueryParams(queryString, includePagination = true) {
  const params = new URLSearchParams(queryString)
  const query = new URLSearchParams()
  if (includePagination) {
    query.set('page', params.get('page') || '1')
    query.set('limit', String(PAGE_SIZE))
  }
  for (const key of ['search', 'department', 'priority', 'status', 'dueDate', 'dueDateFrom', 'dueDateTo']) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }
  query.set('sortBy', params.get('sortBy') || 'createdAt')
  query.set('sortOrder', params.get('sortOrder') || 'desc')
  return query
}

function formatDate(value) {
  if (!value) return '—'
  const calendarDate = String(value).slice(0, 10)
  const date = new Date(`${calendarDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function TaskActionsMenu({ task, onView, onEdit }) {
  const locked = ['Completed', 'Cancelled'].includes(task.status)
  const menuRef = useRef(null)

  function runAction(action) {
    menuRef.current.open = false
    action(task)
  }

  return (
    <details className="task-row-menu" ref={menuRef}>
      <summary aria-label={`Actions for ${task.taskId || task.title}`} title="Task actions">•••</summary>
      <div className="task-row-menu-items">
        <button type="button" onClick={() => runAction(onView)}>View</button>
        <button type="button" onClick={() => runAction(onEdit)} disabled={locked} title={locked ? `${task.status} tasks cannot be edited` : undefined}>Edit</button>
      </div>
    </details>
  )
}

const NEXT_STATUSES = {
  Todo: ['In Progress', 'Cancelled'],
  'In Progress': ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
}

function TaskTable({ tasks, onView, onEdit, onStatusChange, pendingStatusIds, statusErrors }) {
  return (
    <div className="employee-table-scroll task-table-scroll" role="region" aria-label="Task list" tabIndex="0">
      <table className="employee-table task-table">
        <thead><tr>
          <th scope="col">Task ID</th>
          <th scope="col">Title</th>
          <th scope="col">Assigned Employee</th>
          <th scope="col">Department</th>
          <th scope="col">Priority</th>
          <th scope="col">Status</th>
          <th scope="col">Start Date</th>
          <th scope="col">Due Date</th>
          <th scope="col">Overdue</th>
          <th scope="col">Actions</th>
        </tr></thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = task.isOverdue
            const employee = task.assignedEmployee
            return (
              <tr key={task._id}>
                <td className="task-id-cell">{task.taskId || '—'}</td>
                <td className="task-title-cell" title={task.title}>{task.title}</td>
                <td>{employee?.fullName || employee?.employeeId || 'Employee unavailable'}</td>
                <td>{task.department}</td>
                <td><span className={`task-priority priority-${task.priority?.toLowerCase()}`}>{task.priority}</span></td>
                <td>
                  <label className="task-status-control">
                    <span className="visually-hidden">Change status for {task.taskId || task.title}</span>
                    <select
                      aria-label={`Change status for ${task.taskId || task.title}`}
                      className={`task-status task-status-${task.status?.toLowerCase().replaceAll(' ', '-')}`}
                      value={task.status}
                      disabled={pendingStatusIds.has(task._id) || !NEXT_STATUSES[task.status]?.length}
                      onChange={(event) => onStatusChange(task, event.target.value)}
                    >
                      <option value={task.status}>{task.status}</option>
                      {(NEXT_STATUSES[task.status] || []).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    {pendingStatusIds.has(task._id) && <span className="task-status-pending">Saving…</span>}
                    {statusErrors[task._id] && <span className="task-status-error" role="alert">{statusErrors[task._id]}</span>}
                  </label>
                </td>
                <td className="date-cell">{formatDate(task.startDate)}</td>
                <td className="date-cell">{formatDate(task.dueDate)}</td>
                <td>{overdue ? <span className="task-overdue-badge">Overdue</span> : <span className="task-not-overdue">—</span>}</td>
                <td><TaskActionsMenu task={task} onView={onView} onEdit={onEdit} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TaskEmptyState({ filtered }) {
  return (
    <div className="employee-empty-state task-empty-state">
      <span className="empty-icon"><Icon name="check" size={22} /></span>
      <strong>{filtered ? 'No matching tasks' : 'No tasks yet'}</strong>
      <p>{filtered ? 'Try changing or clearing your search and filters.' : 'Tasks will appear here once they’ve been added to your workspace.'}</p>
    </div>
  )
}

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const page = Number(searchParams.get('page') || 1)
  const [requestKey, setRequestKey] = useState(0)
  const [formState, setFormState] = useState({ mode: null, task: null })
  const [viewTask, setViewTask] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingStatusIds, setPendingStatusIds] = useState(() => new Set())
  const [statusErrors, setStatusErrors] = useState({})
  const pendingStatusIdsRef = useRef(new Set())
  const [exporting, setExporting] = useState(false)
  const exportInProgressRef = useRef(false)
  const [exportError, setExportError] = useState('')
  const [result, setResult] = useState({ status: 'loading', tasks: [], pagination: null, error: null, requestToken: null })

  useEffect(() => {
    const controller = new AbortController()
    const requestToken = `${queryString}::${requestKey}`
    const requestParams = buildTaskQueryParams(queryString)

    fetchTasks(requestParams, { signal: controller.signal })
      .then(({ tasks, pagination }) => {
        setResult({ status: 'success', tasks, pagination, error: null, requestToken })
        setViewTask((current) => {
          if (!current) return current
          return tasks.find((task) => task._id === current._id) || current
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          const message = error instanceof TypeError
            ? 'Could not reach the tasks API. Check that the backend is running and the API URL is correct.'
            : error.message
          setResult({ status: 'error', tasks: [], pagination: null, error: message, requestToken })
        }
      })

    return () => controller.abort()
  }, [queryString, requestKey])

  const requestToken = `${queryString}::${requestKey}`
  const loading = result.status === 'loading' || result.requestToken !== requestToken
  const failed = !loading && result.status === 'error'
  const pagination = result.pagination
  const total = pagination?.total ?? 0
  const firstItem = result.tasks.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastItem = Math.min(page * PAGE_SIZE, total)
  const filtered = Boolean(searchParams.get('search') || searchParams.get('department') || searchParams.get('priority') || searchParams.get('status') || searchParams.get('dueDate') || searchParams.get('dueDateFrom') || searchParams.get('dueDateTo'))

  function updateQuery(key, value, resetPage = true) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'dueDate') {
      next.delete('dueDateFrom')
      next.delete('dueDateTo')
    } else if (key === 'dueDateFrom' || key === 'dueDateTo') {
      next.delete('dueDate')
    }
    if (resetPage) next.set('page', '1')
    setSearchParams(next)
  }

  function submitSearch(event) {
    event.preventDefault()
    updateQuery('search', event.currentTarget.elements.search.value.trim())
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams({ page: '1', sortBy: searchParams.get('sortBy') || 'createdAt', sortOrder: searchParams.get('sortOrder') || 'desc' }))
  }

  function retry() {
    setRequestKey((current) => current + 1)
  }

  function handleTaskSaved(task, mode) {
    setFormState({ mode: null, task: null })
    setSuccessMessage(`${task.title} was ${mode === 'edit' ? 'updated' : 'created'} successfully.`)
    setRequestKey((current) => current + 1)
  }

  async function handleExport() {
    if (exportInProgressRef.current) return
    exportInProgressRef.current = true
    setExporting(true)
    setExportError('')
    setSuccessMessage('')
    try {
      const blob = await exportTasksCsv(buildTaskQueryParams(queryString, false))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tasks.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setSuccessMessage('Task CSV exported successfully.')
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Could not reach the tasks API. Check that the backend is running and the API URL is correct.'
        : error.message
      setExportError(message)
    } finally {
      exportInProgressRef.current = false
      setExporting(false)
    }
  }

  async function handleStatusChange(task, status) {
    if (pendingStatusIdsRef.current.has(task._id) || !NEXT_STATUSES[task.status]?.includes(status)) return

    pendingStatusIdsRef.current.add(task._id)
    setPendingStatusIds(new Set(pendingStatusIdsRef.current))
    setStatusErrors((current) => ({ ...current, [task._id]: '' }))
    setSuccessMessage('')

    try {
      const updatedTask = await updateTaskStatus(task._id, status)
      setViewTask((current) => current?._id === task._id
        ? {
            ...current,
            ...updatedTask,
            isOverdue: ['Completed', 'Cancelled'].includes(status) ? false : current.isOverdue,
          }
        : current)
      setSuccessMessage(`${task.title} status changed to ${status}.`)
      setRequestKey((current) => current + 1)
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Could not reach the tasks API. Check that the backend is running and the API URL is correct.'
        : error.message
      setStatusErrors((current) => ({ ...current, [task._id]: message }))
    } finally {
      pendingStatusIdsRef.current.delete(task._id)
      setPendingStatusIds(new Set(pendingStatusIdsRef.current))
    }
  }

  return (
    <div className="page-content employees-page tasks-page">
      <section className="employees-heading">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Tasks</h1>
          <p>Review assignments, priorities, and due dates across your team.</p>
        </div>
        <div className="task-heading-actions">
          <button className="task-export-button" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export to CSV'}
          </button>
          <button className="add-employee-button" type="button" onClick={() => setFormState({ mode: 'create', task: null })}>
            <span aria-hidden="true">+</span> Add Task
          </button>
        </div>
      </section>

      <section className="task-list-panel">
        {exportError && <section className="employee-feedback employee-error task-export-error" role="alert"><span className="employee-feedback-icon">!</span><div><strong>Tasks couldn’t be exported.</strong><p>{exportError}</p></div><button type="button" onClick={() => setExportError('')}>Dismiss</button></section>}
        {successMessage && <div className="employee-success" role="status"><span className="success-check">✓</span><span>{successMessage}</span><button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss success message">×</button></div>}
        <div className="task-filter-toolbar">
          <form className="task-search-form" key={queryString} onSubmit={submitSearch} role="search">
            <Icon name="search" size={16} />
            <input name="search" aria-label="Search tasks" placeholder="Search title or employee" defaultValue={searchParams.get('search') || ''} />
            <button type="submit">Search</button>
          </form>
          <label className="task-filter-control"><span>Department</span><select value={searchParams.get('department') || ''} onChange={(event) => updateQuery('department', event.target.value)}><option value="">All departments</option>{DEPARTMENTS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="task-filter-control"><span>Priority</span><select value={searchParams.get('priority') || ''} onChange={(event) => updateQuery('priority', event.target.value)}><option value="">All priorities</option>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="task-filter-control"><span>Status</span><select value={searchParams.get('status') || ''} onChange={(event) => updateQuery('status', event.target.value)}><option value="">All statuses</option>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="task-filter-control"><span>Due date</span><input type="date" aria-label="Filter by due date" value={searchParams.get('dueDate') || ''} onChange={(event) => updateQuery('dueDate', event.target.value)} /></label>
          {filtered && <button className="task-clear-filters" type="button" onClick={clearFilters}>Clear filters</button>}
        </div>

        <div className="task-list-toolbar">
          <div><h2>All tasks</h2><p>{total.toLocaleString()} task{total === 1 ? '' : 's'}{filtered ? ' match your filters' : ' in your workspace'}</p></div>
          <div className="task-sort-controls">
            <label htmlFor="task-sort">Sort by</label>
            <select id="task-sort" value={searchParams.get('sortBy') || 'createdAt'} onChange={(event) => updateQuery('sortBy', event.target.value)}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Sort direction" value={searchParams.get('sortOrder') || 'desc'} onChange={(event) => updateQuery('sortOrder', event.target.value)}><option value="desc">Newest / latest</option><option value="asc">Oldest / earliest</option></select>
          </div>
        </div>

        {failed ? (
          <section className="employee-feedback employee-error" role="alert"><span className="employee-feedback-icon">!</span><div><strong>Tasks couldn’t be loaded.</strong><p>{result.error}</p></div><button type="button" onClick={retry}>Try again</button></section>
        ) : loading ? (
          <section className="employee-feedback" role="status"><span className="loading-spinner" />Loading tasks…</section>
        ) : result.tasks.length === 0 ? (
          <TaskEmptyState filtered={filtered} />
        ) : (
          <>
            <TaskTable
              tasks={result.tasks}
              onView={setViewTask}
              onEdit={(task) => setFormState({ mode: 'edit', task })}
              onStatusChange={handleStatusChange}
              pendingStatusIds={pendingStatusIds}
              statusErrors={statusErrors}
            />
            <div className="employee-pagination">
              <span>Showing {firstItem}–{lastItem} of {total.toLocaleString()}</span>
              <div className="pagination-controls">
                <button type="button" onClick={() => updateQuery('page', String(Math.max(1, page - 1)), false)} disabled={page <= 1}>Previous</button>
                <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
                <button type="button" onClick={() => updateQuery('page', String(page + 1), false)} disabled={page >= pagination.totalPages}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
      {!loading && !failed && result.tasks.length > 0 && <p className="mobile-table-hint">Scroll horizontally to view all task details.</p>}
      {formState.mode && <TaskForm
        key={`${formState.mode}-${formState.task?._id || 'new'}`}
        mode={formState.mode}
        task={formState.task}
        onClose={() => setFormState({ mode: null, task: null })}
        onCreated={(task) => handleTaskSaved(task, 'create')}
        onUpdated={(task) => handleTaskSaved(task, 'edit')}
      />}
      {viewTask && <TaskDetails task={viewTask} onClose={() => setViewTask(null)} />}
    </div>
  )
}
