import { getAgentBase } from './client'

async function agentRequest(path, { method = 'GET', body, token } = {}) {
  const AGENT_URL = getAgentBase()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${AGENT_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Please start the NetBridge helper on this computer, then try again.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    const raw = data.error || data.local?.error || 'Something went wrong. Please try again.'
    throw new Error(friendlyAgentError(raw))
  }
  return data
}

function friendlyAgentError(message) {
  const text = String(message || '')
  if (/start_agent\.bat|Administrator permission|files on this computer/i.test(text)) {
    return 'Please start the NetBridge helper with Administrator permission (gateway_agent\\start_agent.bat) so friends only get internet.'
  }
  if (/agent|hotspot|internet|administrator|privacy|nat/i.test(text)) {
    if (/not running|helper/i.test(text)) {
      return 'Please start the NetBridge helper on this computer, then try again.'
    }
    if (/no internet|internet connection/i.test(text)) {
      return 'Connect this computer to WiFi first, then start sharing.'
    }
    if (/hotspot|tethering|prepare shared/i.test(text)) {
      return 'Could not start sharing yet. Try again in a moment.'
    }
    if (/privacy|administrator|nat/i.test(text)) {
      return 'Please start the NetBridge helper with Administrator permission, then try again.'
    }
  }
  return text.length > 140 ? 'Something went wrong. Please try again.' : text
}

export const agentApi = {
  health: async () => {
    try {
      const response = await fetch(`${getAgentBase()}/health`)
      if (!response.ok) return { ok: false }
      return response.json()
    } catch {
      return { ok: false }
    }
  },
  status: (token) => agentRequest('/status', { token }),
  ensureWifi: (token, deviceName) =>
    agentRequest('/ensure-wifi', {
      method: 'POST',
      token,
      body: { token, device_name: deviceName },
    }),
  connect: (token, deviceName) =>
    agentRequest('/connect', {
      method: 'POST',
      token,
      body: { token, device_name: deviceName },
    }),
  disconnect: (token) =>
    agentRequest('/disconnect', {
      method: 'POST',
      token,
      body: { token },
    }),
}
