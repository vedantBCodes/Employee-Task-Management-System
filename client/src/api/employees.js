import { API_BASE_URL } from './config'

async function readApiResponse(response) {
  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('The employees API returned an unreadable response.')
  }

  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Unable to complete the employee request.')
    error.status = response.status
    error.details = result?.error?.details || []
    throw error
  }

  return result
}

export async function fetchEmployees({ page = 1, limit = 10, signal } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const response = await fetch(`${API_BASE_URL}/employees?${query}`, { signal })
  const result = await readApiResponse(response)

  const pagination = result?.pagination
  if (
    result?.success !== true ||
    !Array.isArray(result.data) ||
    !Number.isInteger(pagination?.page) ||
    !Number.isInteger(pagination?.limit) ||
    !Number.isInteger(pagination?.total) ||
    !Number.isInteger(pagination?.totalPages)
  ) {
    throw new Error('The employees API response did not match the expected format.')
  }

  return { employees: result.data, pagination }
}

export async function fetchAllEmployees({ signal } = {}) {
  const firstPage = await fetchEmployees({ page: 1, limit: 100, signal })
  const employees = [...firstPage.employees]

  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const nextPage = await fetchEmployees({ page, limit: 100, signal })
    employees.push(...nextPage.employees)
  }

  return employees
}

export async function createEmployee(employee) {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employee),
  })
  const result = await readApiResponse(response)

  if (result?.success !== true || !result.data?._id) {
    throw new Error('The employees API response did not match the expected format.')
  }

  return result.data
}

export async function updateEmployee(id, employee) {
  const response = await fetch(`${API_BASE_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employee),
  })
  const result = await readApiResponse(response)

  if (result?.success !== true || result.data?._id !== id) {
    throw new Error('The employees API response did not match the expected format.')
  }

  return result.data
}

export async function deleteEmployee(id) {
  const response = await fetch(`${API_BASE_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const result = await readApiResponse(response)

  if (result?.success !== true || typeof result.data?.message !== 'string') {
    throw new Error('The employees API response did not match the expected format.')
  }

  return result.data
}
