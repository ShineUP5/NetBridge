import { useState } from 'react'
import { Button } from '../Button'
import { SESSION_OPTIONS } from '../../utils/sessionOptions'

export function PendingRequestItem({ item, onRespond, busyId }) {
  const dependant = item.dependant
  const busy = String(busyId) === String(item.id)
  const [sessionMinutes, setSessionMinutes] = useState(0)

  return (
    <article className="request-card">
      <div>
        <h3>{dependant?.full_name || 'Friend'}</h3>
        <p className="muted">{dependant?.phone}</p>
        <p className="muted">{dependant?.email}</p>
        <label className="session-field">
          <span className="muted">Online time</span>
          <select
            value={sessionMinutes}
            disabled={busy}
            onChange={(e) => setSessionMinutes(Number(e.target.value))}
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
          disabled={busy}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRespond(item.id, true, sessionMinutes)
          }}
        >
          {busy ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRespond(item.id, false)
          }}
        >
          Deny
        </Button>
      </div>
    </article>
  )
}
