const LOCAL_GATEWAY_ORIGIN = 'http://127.0.0.1:8765'
const AUTH_STORAGE_KEY = 'netbridge_auth'

/** True when the app runs on Vercel/public host — not on the PC helper. */
export function isPublicHostedSite() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host !== '127.0.0.1' && host !== 'localhost' && host !== '192.168.137.1'
}

/** Open the SERVER dashboard on this PC (same origin as helper — no Chrome loopback block). */
export function buildLocalGatewayUrl(authPayload = null) {
  let auth = authPayload
  if (!auth) {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      auth = raw ? JSON.parse(raw) : null
    } catch {
      auth = null
    }
  }
  const access = auth?.tokens?.access
  if (!access) {
    return `${LOCAL_GATEWAY_ORIGIN}/gateway`
  }
  const q = new URLSearchParams({
    nb_access: access,
    nb_refresh: auth.tokens.refresh || '',
  })
  return `${LOCAL_GATEWAY_ORIGIN}/gateway?${q}`
}

export function redirectToLocalGateway(authPayload = null) {
  window.location.href = buildLocalGatewayUrl(authPayload)
}

/** One-time auth handoff from Vercel → localhost (different origins). */
export function consumeUrlAuthBootstrap() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const access = params.get('nb_access')
  if (!access) return null

  const refresh = params.get('nb_refresh') || ''
  params.delete('nb_access')
  params.delete('nb_refresh')
  const rest = params.toString()
  const path = window.location.pathname
  window.history.replaceState({}, '', rest ? `${path}?${rest}` : path)

  return {
    tokens: { access, refresh },
    user: null,
  }
}
