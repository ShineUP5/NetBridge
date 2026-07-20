import { request } from './client'

export const dependantApi = {
  requestConnect: (token, code) =>
    request('/dependant/request-connect/', {
      method: 'POST',
      token,
      body: { code },
    }),
  connection: (token) => request('/dependant/connection/', { token }),
  disconnect: (token) =>
    request('/dependant/disconnect/', {
      method: 'POST',
      token,
    }),
}
