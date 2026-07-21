import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { consumeUrlAuthBootstrap } from '../utils/localGateway'

const AuthContext = createContext(null)
const STORAGE_KEY = 'netbridge_auth'

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function initialAuth() {
  return loadStored() || consumeUrlAuthBootstrap()
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => initialAuth())
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      if (!auth?.tokens?.access) {
        setBooting(false)
        return
      }
      try {
        const user = await api.me(auth.tokens.access)
        if (!cancelled) {
          const next = { ...auth, user }
          setAuth(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
      } catch {
        if (!cancelled) {
          setAuth(null)
          localStorage.removeItem(STORAGE_KEY)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      token: auth?.tokens?.access ?? null,
      booting,
      async signup(payload) {
        const data = await api.signup(payload)
        setAuth(data)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        return data
      },
      async login(payload) {
        const data = await api.login(payload)
        setAuth(data)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        return data
      },
      logout() {
        setAuth(null)
        localStorage.removeItem(STORAGE_KEY)
      },
    }),
    [auth, booting],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function roleHome(role) {
  return role === 'gateway' ? '/gateway' : '/dependant'
}
