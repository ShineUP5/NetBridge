import { useState } from 'react'
import { Button } from '../Button'
import { SESSION_OPTIONS, sessionMinutesPayload } from '../../utils/sessionOptions'

export function ConnectedDependantsPanel({
  dependants,
  onDisconnect,
  onSetSession,
  busyId,
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Connected friends</h2>
        {dependants.length ? <span className="pill">{dependants.length}</span> : null}
      </div>
      <p className="lead">
        Set how long each friend stays online, or disconnect them while you keep sharing.
      </p>

      {dependants.length === 0 ? (
        <p className="muted">No friends connected yet.</p>
      ) : (
        <div className="stack">
          {dependants.map((item) => (
            <ConnectedFriendRow
              key={item.id}
              item={item}
              busy={String(busyId) === String(item.id)}
              onDisconnect={onDisconnect}
              onSetSession={onSetSession}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ConnectedFriendRow({ item, busy, onDisconnect, onSetSession }) {
  const [minutes, setMinutes] = useState(item.session_minutes || 0)
  const name = item.dependant?.full_name || item.dependant?.phone || 'Friend'

  return (
    <article className="request-card connected-friend-card">
      <div>
        <h3>{name}</h3>
        <p className="muted">{item.dependant?.phone}</p>
        <p className="session-remaining">{item.session_label || 'No time limit'}</p>
        <label className="session-field">
          <span className="muted">Change time</span>
          <select
            value={minutes}
            disabled={busy}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {SESSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="request-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => onSetSession(item.id, sessionMinutesPayload(minutes))}
        >
          {busy ? 'Saving…' : 'Apply time'}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => onDisconnect(item.id)}
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </div>
    </article>
  )
}
