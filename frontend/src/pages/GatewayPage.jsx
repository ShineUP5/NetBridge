import { useCallback, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { agentApi } from '../api/agent'
import { gatewayApi } from '../api/gateway'
import { CoveragePanel } from '../components/gateway/CoveragePanel'
import { ConnectedDependantsPanel } from '../components/gateway/ConnectedDependantsPanel'
import { GatewayConnectCard } from '../components/gateway/GatewayConnectCard'
import { InviteCodePanel } from '../components/gateway/InviteCodePanel'
import { JoinLinkPanel } from '../components/gateway/JoinLinkPanel'
import { PendingRequestsPanel } from '../components/gateway/PendingRequestsPanel'
import { PrivacyShieldPanel } from '../components/gateway/PrivacyShieldPanel'
import { Shell } from '../components/Shell'
import { Topbar } from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import { usePolling } from '../hooks/usePolling'
import { sessionMinutesPayload } from '../utils/sessionOptions'

export default function GatewayPage() {
  const { user, token, booting, logout } = useAuth()
  const [status, setStatus] = useState(null)
  const [agentOnline, setAgentOnline] = useState(false)
  const [invite, setInvite] = useState(null)
  const [pending, setPending] = useState([])
  const [connected, setConnected] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState('')
  const [busyRequestId, setBusyRequestId] = useState(null)

  const pollTick = useRef(0)

  const rotateWifiPassword = useCallback(async () => {
    const health = await agentApi.health()
    if (!health?.ok) {
      throw new Error(
        'Start the NetBridge helper as Administrator so the WiFi password can change and kick the friend offline.',
      )
    }
    const result = await agentApi.ensureWifi(token, status?.device_name)
    if (result?.cloud) setStatus(result.cloud)
    return result
  }, [token, status?.device_name])

  const refresh = useCallback(async () => {
    if (!token) return
    pollTick.current += 1
    // Agent status is heavier — sync every other poll (same data path, less load)
    const syncAgent = pollTick.current === 1 || pollTick.current % 2 === 0
    try {
      let healthOk = agentOnline
      if (syncAgent) {
        try {
          const synced = await agentApi.status(token)
          healthOk = true
          setAgentOnline(true)
          if (synced?.cloud) {
            setStatus(synced.cloud)
            if (Number(synced.cloud.sessions_expired || 0) > 0) {
              try {
                await agentApi.ensureWifi(token, synced.cloud.device_name)
              } catch {
                // Timed-out friends already lost credentials; password rotate is best-effort.
              }
            }
          }
        } catch {
          const health = await agentApi.health()
          healthOk = Boolean(health?.ok)
          setAgentOnline(healthOk)
        }
      }

      const [deviceStatus, pendingRequests, connectedPayload] = await Promise.all([
        gatewayApi.status(token),
        gatewayApi.pendingRequests(token),
        gatewayApi.connectedDependants(token),
      ])
      setStatus(deviceStatus)
      setPending(Array.isArray(pendingRequests) ? pendingRequests : [])
      setConnected(connectedPayload.dependants)

      if (connectedPayload.sessions_expired > 0 && healthOk) {
        try {
          await rotateWifiPassword()
        } catch {
          // Session already ended in the API; rotate is best-effort for real WiFi cut-off.
        }
      }

      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [token, rotateWifiPassword, agentOnline])

  const pollMs = pending.length ? 7000 : 14000
  usePolling(refresh, pollMs, Boolean(token && user?.role === 'gateway'))

  async function handleConnect(deviceName) {
    setBusy('connect')
    setError('')
    setSuccess('')
    try {
      const result = await agentApi.connect(token, deviceName)
      setStatus(result.cloud)
      setAgentOnline(true)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleDisconnect() {
    setBusy('disconnect')
    setError('')
    setSuccess('')
    try {
      await agentApi.disconnect(token)
      setInvite(null)
      setSuccess('Sharing stopped. All friends were disconnected.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleGenerateInvite() {
    setBusy('invite')
    setError('')
    try {
      const next = await gatewayApi.createInvite(token)
      setInvite(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleRespond(requestId, approve, sessionMinutes = 0) {
    setBusyRequestId(requestId)
    setError('')
    setSuccess('')
    try {
      // Prefer credentials already on the dashboard — avoid blocking on slow helper sync.
      if (approve) {
        const hasCreds = Boolean(status?.hotspot_ssid && status?.hotspot_password)
        if (!hasCreds) {
          const health = await agentApi.health()
          if (!health?.ok) {
            throw new Error(
              'Start the NetBridge helper, tap Start sharing, then approve.',
            )
          }
          let synced = await agentApi.status(token)
          let cloud = synced?.cloud
          if (!cloud?.hotspot_password || !cloud?.hotspot_ssid) {
            synced = await agentApi.ensureWifi(
              token,
              cloud?.device_name || status?.device_name,
            )
            cloud = synced?.cloud
          }
          if (cloud) setStatus(cloud)
          if (!cloud?.hotspot_password || !cloud?.hotspot_ssid) {
            throw new Error(
              'Shared WiFi is not ready. Tap Start sharing, wait for the WiFi name/password, then approve.',
            )
          }
        }
      }

      const minutes = approve ? sessionMinutesPayload(sessionMinutes) : null
      const result = await gatewayApi.respond(token, requestId, approve, minutes)

      // Don't freeze the Approve button waiting on a full helper refresh
      refresh().catch(() => {})

      if (approve) {
        const name = result?.dependant?.full_name || result?.dependant?.phone || 'your friend'
        const ssid = result?.wifi?.ssid || status?.hotspot_ssid || 'your shared WiFi'
        const timeNote = result?.session_label ? ` Time: ${result.session_label}.` : ''
        setSuccess(`Approved ${name}. They should join WiFi “${ssid}”.${timeNote}`)
        setPending((prev) => prev.filter((item) => String(item.id) !== String(requestId)))
      } else {
        setSuccess('Request denied.')
        setPending((prev) => prev.filter((item) => String(item.id) !== String(requestId)))
      }
    } catch (err) {
      setSuccess('')
      setError(err.message)
    } finally {
      setBusyRequestId(null)
    }
  }

  async function handleDisconnectDependant(requestId) {
    setBusyRequestId(requestId)
    setError('')
    setSuccess('')
    try {
      const result = await gatewayApi.disconnectDependant(token, requestId)
      if (result?.rotate_wifi) {
        await rotateWifiPassword()
      }
      await refresh()
      const name =
        result?.connection?.dependant?.full_name ||
        result?.connection?.dependant?.phone ||
        'Friend'
      setSuccess(
        `Disconnected ${name}. WiFi password changed so they go offline; other friends get the new password automatically.`,
      )
    } catch (err) {
      setSuccess('')
      setError(err.message)
    } finally {
      setBusyRequestId(null)
    }
  }

  async function handleSetSession(requestId, sessionMinutes) {
    setBusyRequestId(requestId)
    setError('')
    setSuccess('')
    try {
      const result = await gatewayApi.setSession(token, requestId, sessionMinutes)
      await refresh()
      const name = result?.dependant?.full_name || result?.dependant?.phone || 'Friend'
      setSuccess(`Updated online time for ${name}: ${result?.session_label || 'No time limit'}.`)
    } catch (err) {
      setSuccess('')
      setError(err.message)
    } finally {
      setBusyRequestId(null)
    }
  }

  if (booting) {
    return (
      <Shell>
        <p className="lead">Loading…</p>
      </Shell>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'gateway') return <Navigate to="/dependant" replace />

  const sharingReady = Boolean(
    status?.is_connected && status?.hotspot_active && (status?.hotspot_ssid || status?.is_live),
  )

  return (
    <Shell>
      <Topbar user={user} onLogout={logout} />
      <section className="dash">
        <h1>Share internet</h1>
        <p className="lead">
          Start sharing on this computer, invite friends with a code, then approve them.
        </p>
        {error ? <p className="error banner">{error}</p> : null}
        {success ? <p className="success banner">{success}</p> : null}
      </section>

      <div className="grid-panels">
        <GatewayConnectCard
          status={status}
          agentOnline={agentOnline}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          loading={busy === 'connect' || busy === 'disconnect'}
          onHelperReady={() => {
            setAgentOnline(true)
            refresh()
          }}
        />
        <JoinLinkPanel status={status} />
        <CoveragePanel status={status} />
        <PrivacyShieldPanel status={status} />
        <InviteCodePanel
          invite={invite}
          onGenerate={handleGenerateInvite}
          loading={busy === 'invite'}
          disabled={!sharingReady}
        />
        <PendingRequestsPanel
          requests={pending}
          onRespond={handleRespond}
          busyId={busyRequestId}
        />
        <ConnectedDependantsPanel
          dependants={connected}
          onDisconnect={handleDisconnectDependant}
          onSetSession={handleSetSession}
          busyId={busyRequestId}
        />
      </div>
    </Shell>
  )
}
