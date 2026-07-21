const RENDER_API = 'https://netbridge-d5l8.onrender.com/api'
export const JOIN_PAGE_URL = 'http://192.168.137.1:8765/join'

function isHelperOrigin() {
  if (typeof window === 'undefined') return false
  const { hostname, port } = window.location
  if (port === '8765') return true
  if (hostname === '192.168.137.1') return true
  return false
}

export function isOnHelperApp() {
  return isHelperOrigin()
}

export function getJoinPageUrl() {
  if (isHelperOrigin()) {
    return `${window.location.origin}/join`
  }
  return JOIN_PAGE_URL
}

export function getApiBase() {
  // Helper serves the app and proxies /api → Render (works on PC and on hotspot phones).
  if (isHelperOrigin()) {
    return `${window.location.origin}/api`
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }

  return RENDER_API
}

export function getAgentBase() {
  if (isHelperOrigin()) {
    return window.location.origin
  }

  if (import.meta.env.VITE_AGENT_URL) return import.meta.env.VITE_AGENT_URL

  return 'http://127.0.0.1:8765'
}

/** Max wait for cloud API (Render cold start). Then fail so the user can retry. */
export const API_TIMEOUT_MS = 25000
export const API_SLOW_TIMEOUT_MS = 45000

function networkErrorMessage() {
  if (isHelperOrigin()) {
    return 'Could not reach the server through this PC. Check the PC has internet (HOLY SPOT / WiFi), keep the helper open, then try again.'
  }
  return `Could not reach the server. If you are on your friend's shared WiFi, open ${JOIN_PAGE_URL} instead of this website, then try again.`
}

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

export async function request(
  path,
  { method = 'GET', body, token, timeoutMs = API_TIMEOUT_MS, retries = 0 } = {},
) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let lastError
  const attempts = Math.max(1, retries + 1)

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${getApiBase()}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(formatError(data))
      return data
    } catch (err) {
      lastError = err
      if (err?.name === 'AbortError') {
        lastError = new Error(
          `Server took too long (max ${Math.round(timeoutMs / 1000)}s). Please try again — the first try may wake the server.`,
        )
      } else if (err instanceof TypeError) {
        lastError = new Error(networkErrorMessage())
      }
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        continue
      }
      throw lastError
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

/** Fire-and-forget wake-up so signup/login is less likely to hit a cold server. */
export async function wakeApi() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    await fetch(`${getApiBase()}/health/`, { signal: controller.signal, cache: 'no-store' })
  } catch {
    // Best-effort only.
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  signup: (payload) => request('/auth/signup/', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login/', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me/', { token, timeoutMs: 20000 }),
  health: () => request('/health/', { timeoutMs: 15000 }),
}
