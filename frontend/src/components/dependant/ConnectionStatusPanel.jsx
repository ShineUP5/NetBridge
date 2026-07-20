import { Button } from '../Button'
import { StatusBadge } from '../StatusBadge'

const STATUS_COPY = {
  pending: {
    title: 'Waiting',
    message: 'Your friend got your request. Hang tight while they approve you.',
    connected: false,
  },
  connected: {
    title: 'Approved',
    message: 'Next step: join their shared WiFi below to get real internet.',
    connected: true,
  },
  denied: {
    title: 'Not approved',
    message: 'Ask your friend for a new code and try again.',
    connected: false,
  },
  disconnected: {
    title: 'Session ended',
    message: 'Ask for a new code when you want to join again.',
    connected: false,
  },
}

const DISCONNECT_REASON_COPY = {
  self: 'You disconnected. Leave their WiFi in phone settings if you are still on it.',
  gateway: 'Your friend ended your session. Leave their WiFi in phone settings.',
  expired: 'Your online time ended. Ask for a new code to join again.',
  gateway_offline: 'Your friend stopped sharing. You are offline now.',
  replaced: 'Session ended. Ask for a new code to join again.',
}

export function ConnectionStatusPanel({ connection, onDisconnect, disconnecting }) {
  if (!connection) {
    return (
      <section className="panel dependant-panel">
        <div className="panel-head">
          <h2>Your status</h2>
          <StatusBadge connected={false} />
        </div>
        <p className="muted">You have not joined anyone yet.</p>
      </section>
    )
  }

  const copy = STATUS_COPY[connection.status] || STATUS_COPY.pending
  const gateway = connection.gateway
  const isConnected = connection.status === 'connected'
  const message =
    connection.status === 'disconnected' && connection.disconnect_reason
      ? DISCONNECT_REASON_COPY[connection.disconnect_reason] || copy.message
      : copy.message

  return (
    <section className={`panel dependant-panel status-${connection.status}`}>
      <div className="panel-head">
        <h2>Your status</h2>
        <StatusBadge connected={copy.connected} />
      </div>
      <div className="status-body">
        <h3>{copy.title}</h3>
        <p className="lead">{message}</p>
        {isConnected && connection.session_label ? (
          <p className="session-remaining">{connection.session_label}</p>
        ) : null}
      </div>
      <ul className="facts compact dependant-facts">
        <li>
          <strong>Sharing with</strong>
          <span>{gateway.full_name || gateway.phone}</span>
        </li>
        <li>
          <strong>Phone</strong>
          <span>{gateway.phone}</span>
        </li>
      </ul>
      {isConnected && onDisconnect ? (
        <Button
          type="button"
          variant="ghost"
          className="dependant-submit"
          disabled={disconnecting}
          onClick={onDisconnect}
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect me'}
        </Button>
      ) : null}
    </section>
  )
}
