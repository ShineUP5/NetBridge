import { API_SLOW_TIMEOUT_MS, request, wakeApi } from './client'

export const dependantApi = {
  requestConnect: async (token, code) => {
    await wakeApi()
    return request('/dependant/request-connect/', {
      method: 'POST',
      token,
      body: { code },
      timeoutMs: API_SLOW_TIMEOUT_MS,
      retries: 1,
    })
  },
  connection: (token) => request('/dependant/connection/', { token, retries: 1 }),
  disconnect: (token) =>
    request('/dependant/disconnect/', {
      method: 'POST',
      token,
      timeoutMs: API_SLOW_TIMEOUT_MS,
    }),
}
