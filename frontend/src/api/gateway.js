import { request } from './client'

export const gatewayApi = {
  status: (token) => request('/gateway/status/', { token }),
  pendingRequests: (token) => request('/gateway/requests/pending/', { token }),
  respond: (token, requestId, approve, sessionMinutes = null) =>
    request(`/gateway/requests/${requestId}/respond/`, {
      method: 'POST',
      token,
      body: {
        approve,
        session_minutes: approve ? sessionMinutes : null,
      },
    }),
  connectedDependants: async (token) => {
    const data = await request('/gateway/dependants/connected/', { token })
    // Support both legacy array and { dependants, sessions_expired }
    if (Array.isArray(data)) {
      return { dependants: data, sessions_expired: 0 }
    }
    return {
      dependants: Array.isArray(data?.dependants) ? data.dependants : [],
      sessions_expired: Number(data?.sessions_expired || 0),
    }
  },
  disconnectDependant: (token, requestId) =>
    request(`/gateway/dependants/${requestId}/disconnect/`, {
      method: 'POST',
      token,
    }),
  setSession: (token, requestId, sessionMinutes) =>
    request(`/gateway/dependants/${requestId}/session/`, {
      method: 'POST',
      token,
      body: { session_minutes: sessionMinutes },
    }),
  createInvite: (token) =>
    request('/gateway/invite/', { method: 'POST', token }),
}
