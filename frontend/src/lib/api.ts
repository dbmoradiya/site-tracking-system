export type Role = 'ADMIN' | 'COORDINATOR' | 'SUPERVISOR' | 'DESIGN_ENGINEER' | 'PROCUREMENT_MANAGER'
export type User = { id: number; employeeId: number | null; name: string; mobile: string; roles: Role[] }
export const hasRole = (user: User | null | undefined, role: Role) => Boolean(user?.roles.includes(role))

const API_URL = import.meta.env.VITE_API_URL || '/api'

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  // UI preview build only: there is no backend, so skip network calls.
  if (import.meta.env.VITE_UI_PREVIEW) { const { previewApi } = await import('../preview/projectMock'); return previewApi(path) as T }
  const token = localStorage.getItem('sitetrack-token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try { message = (await response.json()).message || message } catch { /* keep fallback */ }
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('sitetrack:unauthorized'))
    throw new Error(message)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  return response.json() as Promise<T>
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })

export async function apiBlob(path: string) {
  const token = localStorage.getItem('sitetrack-token')
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) throw new Error(`Could not open evidence (${response.status})`)
  return response.blob()
}

export function humanStatus(status: string) {
  return status.toLowerCase().split('_').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}
