import { API_BASE_URL } from './config'

async function readTaskResponse(response) {
  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('The tasks API returned an unreadable response.')
  }

  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Unable to complete the task request.')
    error.status = response.status
    error.details = result?.error?.details || []
    throw error
  }

  return result
}

export async function fetchTasks(params, { signal } = {}) {
  const query = new URLSearchParams(params)
  const response = await fetch(`${API_BASE_URL}/tasks?${query}`, { signal })
  const result = await readTaskResponse(response)

  const pagination = result?.pagination
  if (
    result?.success !== true ||
    !Array.isArray(result.data) ||
    !Number.isInteger(pagination?.page) ||
    !Number.isInteger(pagination?.limit) ||
    !Number.isInteger(pagination?.total) ||
    !Number.isInteger(pagination?.totalPages) ||
    !result.data.every((task) => typeof task?.isOverdue === 'boolean')
  ) {
    throw new Error('The tasks API response did not match the expected format.')
  }

  return { tasks: result.data, pagination }
}

export async function createTask(task) {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  const result = await readTaskResponse(response)

  if (result?.success !== true || !result.data?._id || !result.data?.taskId) {
    throw new Error('The tasks API response did not match the expected format.')
  }

  return result.data
}

export async function updateTask(id, task) {
  const response = await fetch(`${API_BASE_URL}/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  const result = await readTaskResponse(response)

  if (result?.success !== true || result.data?._id !== id) {
    throw new Error('The tasks API response did not match the expected format.')
  }

  return result.data
}

export async function updateTaskStatus(id, status) {
  const response = await fetch(`${API_BASE_URL}/tasks/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  const result = await readTaskResponse(response)

  if (result?.success !== true || result.data?._id !== id || result.data?.status !== status) {
    throw new Error('The tasks API response did not match the expected format.')
  }

  return result.data
}

export async function exportTasksCsv(params) {
  const query = new URLSearchParams(params)
  const response = await fetch(`${API_BASE_URL}/tasks/export?${query}`)

  if (!response.ok) {
    let result
    try {
      result = await response.json()
    } catch {
      throw new Error('Unable to export tasks.')
    }
    const error = new Error(result?.error?.message || 'Unable to export tasks.')
    error.status = response.status
    throw error
  }

  if (!response.headers.get('content-type')?.includes('text/csv')) {
    throw new Error('The tasks API returned an invalid CSV response.')
  }

  return response.blob()
}
