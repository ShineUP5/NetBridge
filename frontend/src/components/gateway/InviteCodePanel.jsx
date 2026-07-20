import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { copyText } from '../../utils/copyText'
import { formatCountdown, secondsUntil } from '../../utils/time'

export function InviteCodePanel({ invite, onGenerate, loading, disabled }) {
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState(() => secondsUntil(invite?.expires_at))

  useEffect(() => {
    if (!invite?.expires_at) return undefined
    setRemaining(secondsUntil(invite.expires_at))
    const id = setInterval(() => {
      setRemaining(secondsUntil(invite.expires_at))
    }, 1000)
    return () => clearInterval(id)
  }, [invite])

  async function handleCopy() {
    if (!invite?.code) return
    await copyText(invite.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Invite code</h2>
        {invite ? <span className="timer">{formatCountdown(remaining)}</span> : null}
      </div>
      <p className="lead">
        Create a code, send it to a friend, and approve them when they ask to join.
      </p>

      {invite && remaining > 0 ? (
        <div className="code-box">
          <span className="code-value">{invite.code}</span>
          <Button variant="ghost" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ) : invite ? (
        <p className="muted">This code expired. Make a new one.</p>
      ) : null}

      <Button disabled={disabled || loading} onClick={onGenerate}>
        {loading ? 'Creating…' : invite ? 'New code' : 'Create code'}
      </Button>
    </section>
  )
}
