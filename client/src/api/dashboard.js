import { API_BASE_URL } from './config'

export async function fetchDashboardStats({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/dashboard`, { signal })
  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('The dashboard API returned an unreadable response.')
  }

  if (!response.ok) {
    throw new Error(result?.error?.message || 'Unable to load dashboard statistics.')
  }

  const data = result?.data
  const numericValues = [
    data?.employees?.total,
    data?.employees?.active,
    data?.tasks?.total,
    data?.tasks?.overdue,
    data?.tasks?.byStatus?.Todo,
    data?.tasks?.byStatus?.['In Progress'],
    data?.tasks?.byStatus?.Completed,
    data?.tasks?.byStatus?.Cancelled,
  ]

  if (
    result?.success !== true ||
    !numericValues.every((value) => Number.isFinite(value)) ||
    !Array.isArray(data?.employeeWorkload) ||
    !data.employeeWorkload.every((employee) =>
      typeof employee?._id === 'string' &&
      typeof employee.employeeId === 'string' &&
      typeof employee.fullName === 'string' &&
      typeof employee.department === 'string' &&
      Number.isFinite(employee.tasks?.todo) &&
      Number.isFinite(employee.tasks?.inProgress) &&
      Number.isFinite(employee.tasks?.totalActive)
    )
  ) {
    throw new Error('The dashboard API response did not match the expected format.')
  }

  return data
}
