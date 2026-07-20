import { getAgentBase } from './client'

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/** Chrome Local Network Access: public site → localhost/private helper. */
function agentTargetAddressSpace() {
  try {
    const host = new URL(getAgentBase()).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
      return 'loopback'
    }
    return 'local'
  } catch {
    return 'loopback'
  }
}

function agentFetchInit(extra = {}) {
  return {
    ...extra,
    // Annotate destination so Chrome allows HTTPS page → http://127.0.0.1 helper.
    targetAddressSpace: agentTargetAddressSpace(),
  }
}

let localAccessProbe = null

/**
 * Ask Chrome for permission to talk to the local NetBridge helper.
 * Must run from a secure context (https://net-bridge-pied.vercel.app).
 */
export async function ensureLocalAgentAccess() {
  if (typeof window === 'undefined') return true

  try {
    for (const name of ['loopback-network', 'local-network', 'local-network-access']) {
      try {
        const status = await navigator.permissions.query({ name })
        if (status.state === 'granted') return true
        if (status.state === 'denied') {
          return false
        }
      } catch {
        // Permission name not supported in this browser — continue.
      }
    }
  } catch {
    // Permissions API unavailable.
  }

  if (!localAccessProbe) {
    localAccessProbe = (async () => {
      const { signal, clear } = withTimeout(4000)
      try {
        await fetch(
          `${getAgentBase()}/health`,
          agentFetchInit({ method: 'GET', cache: 'no-store', signal }),
        )
        return true
      } catch {
        return false
      } finally {
        clear()
        localAccessProbe = null
      }
    })()
  }
  return localAccessProbe
}

async function agentRequest(path, { method = 'GET', body, token, timeoutMs = 12000 } = {}) {
  const AGENT_URL = getAgentBase()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  await ensureLocalAgentAccess()

  const { signal, clear } = withTimeout(timeoutMs)
  let response
  try {
    response = await fetch(
      `${AGENT_URL}${path}`,
      agentFetchInit({
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      }),
    )
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Helper took too long. Keep the helper window open, then try again.')
    }
    throw new Error(
      'Please allow local network access for NetBridge in the browser prompt, keep the helper open, then try again.',
    )
  } finally {
    clear()
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    const raw = data.error || data.local?.error || 'Something went wrong. Please try again.'
    throw new Error(friendlyAgentError(raw))
  }
  return data
}

function friendlyAgentError(message) {
  let text = String(message || '')
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      text = String(parsed.detail || parsed.error || text)
    }
  } catch {
    // not JSON
  }
  if (/token|unauthorized|authentication|login expired|credentials were not provided/i.test(text)) {
    return 'Your login expired. Log out, log in again, then tap Start sharing.'
  }
  if (/start_agent\.bat|Administrator permission|files on this computer/i.test(text)) {
    return 'Please start the NetBridge helper with Administrator permission so friends only get internet.'
  }
  if (/agent|hotspot|internet|administrator|privacy|nat/i.test(text)) {
    if (/not running|helper/i.test(text)) {
      return 'Please start the NetBridge helper on this computer, then try again.'
    }
    if (/no internet|internet connection/i.test(text)) {
      return 'Connect this computer to WiFi first, then start sharing.'
    }
    if (/hotspot|tethering|prepare shared|password did not stick|did not apply|did not accept/i.test(text)) {
      return text.length > 160 ? 'Could not start sharing. Turn Mobile hotspot Off in Windows Settings, then try again.' : text
    }
    if (/privacy|administrator|nat/i.test(text)) {
      return 'Please start the NetBridge helper with Administrator permission, then try again.'
    }
  }
  return text.length > 160 ? 'Something went wrong. Please try again.' : text
}

export const agentApi = {
  health: async () => {
    await ensureLocalAgentAccess()
    const { signal, clear } = withTimeout(2500)
    try {
      const response = await fetch(
        `${getAgentBase()}/health`,
        agentFetchInit({ signal, cache: 'no-store' }),
      )
      if (!response.ok) return { ok: false }
      return response.json()
    } catch {
      return { ok: false }
    } finally {
      clear()
    }
  },
  status: (token) => agentRequest('/status', { token, timeoutMs: 10000 }),
  ensureWifi: (token, deviceName, { rotate = false } = {}) =>
    agentRequest('/ensure-wifi', {
      method: 'POST',
      token,
      timeoutMs: 45000,
      body: { token, device_name: deviceName, rotate },
    }),
  connect: (token, deviceName) =>
    agentRequest('/connect', {
      method: 'POST',
      token,
      timeoutMs: 60000,
      body: { token, device_name: deviceName },
    }),
  disconnect: (token) =>
    agentRequest('/disconnect', {
      method: 'POST',
      token,
      timeoutMs: 20000,
      body: { token },
    }),
}
