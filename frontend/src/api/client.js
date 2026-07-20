export function getApiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    // Served by gateway helper — phone has no upstream internet, API is proxied locally
    if (port === '8765' || hostname === '192.168.137.1') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`
    }
  }

  return 'http://127.0.0.1:8000/api'
}

export function getAgentBase() {
  if (import.meta.env.VITE_AGENT_URL) return import.meta.env.VITE_AGENT_URL

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    if (port === '8765') {
      return `${protocol}//${hostname}:8765`
    }
  }

  return 'http://127.0.0.1:8765'
}

/** Max wait for cloud API (Render cold start). Then fail so the user can retry. */
export const API_TIMEOUT_MS = 25000

export function formatError(data) {
  if (!data || typeof data !== 'object') return 'Request failed'
  if (typeof data.detail === 'string') return data.detail
  const parts = Object.entries(data).flatMap(([key, value]) => {
    if (Array.isArray(value)) return value.map((item) => `${key}: ${item}`)
    if (typeof value === 'string') return [`${key}: ${value}`]
    return []
  })
  return parts.join(' ') || 'Request failed'
}

export async function request(path, { method = 'GET', body, token, timeoutMs = API_TIMEOUT_MS } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(formatError(data))
    return data
  } catch (err) {
    if (err?.name === 'AbortError') {
      const secs = Math.round(timeoutMs / 1000)
      throw new Error(
        `Server took too long (max ${secs}s). Please try again — the first try may wake the server.`,
      )
    }
    if (err instanceof TypeError) {
      throw new Error('Could not reach the server. Check your internet, then try again.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Fire-and-forget wake-up so signup/login is less likely to hit a cold server. */
export function wakeApi() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  fetch(`${getApiBase()}/health/`, { signal: controller.signal, cache: 'no-store' })
    .catch(() => {})
    .finally(() => clearTimeout(timer))
}

export const api = {
  signup: (payload) => request('/auth/signup/', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login/', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me/', { token, timeoutMs: 20000 }),
  health: () => request('/health/', { timeoutMs: 15000 }),
}
