import { useCallback, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { dependantApi } from '../api/dependant'
import { ConnectionStatusPanel } from '../components/dependant/ConnectionStatusPanel'
import { ConnectCodeForm } from '../components/dependant/ConnectCodeForm'
import { WifiJoinPanel } from '../components/dependant/WifiJoinPanel'
import { Shell } from '../components/Shell'
import { Topbar } from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import { usePolling } from '../hooks/usePolling'

export default function DependantPage() {
  const { user, token, booting, logout } = useAuth()
  const [connection, setConnection] = useState(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const data = await dependantApi.connection(token)
      setConnection(data.connection)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  usePolling(refresh, 3000, Boolean(token && user?.role === 'dependant'))

  async function handleConnect(code) {
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const data = await dependantApi.requestConnect(token, code)
      setConnection(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setError('')
    setInfo('')
    try {
      const data = await dependantApi.disconnect(token)
      setConnection(data.connection)
      setInfo(
        data.detail ||
          'You are disconnected. Leave their WiFi in phone settings to go fully offline.',
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (booting) {
    return (
      <Shell className="dependant-shell">
        <p className="lead">Loading…</p>
      </Shell>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'gateway' && user.role !== 'dependant') {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'dependant') return <Navigate to="/gateway" replace />

  const canRequest =
    !connection ||
    connection.status === 'denied' ||
    connection.status === 'disconnected'

  const showWifi = connection?.status === 'connected' && connection?.wifi

  return (
    <Shell className="dependant-shell">
      <Topbar user={user} onLogout={logout} />
      <section className="dash dependant-hero">
        <h1>Join a friend</h1>
        <p className="lead">
          Enter their code, wait for approval, then join their WiFi for real internet.
        </p>
        {error ? <p className="error banner">{error}</p> : null}
        {info ? <p className="info banner">{info}</p> : null}
      </section>

      <div className="dependant-grid">
        <ConnectCodeForm
          onSubmit={handleConnect}
          loading={loading}
          disabled={!canRequest || connection?.status === 'pending'}
        />
        <ConnectionStatusPanel
          connection={connection}
          onDisconnect={handleDisconnect}
          disconnecting={disconnecting}
        />
        {showWifi ? <WifiJoinPanel wifi={connection.wifi} /> : null}
      </div>
    </Shell>
  )
}
