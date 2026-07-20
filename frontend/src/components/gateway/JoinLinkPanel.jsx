import { useState } from 'react'
import { Button } from '../Button'
import { copyText } from '../../utils/copyText'

export function JoinLinkPanel({ status }) {
  const [copied, setCopied] = useState(false)
  const lanIp = status?.gateway_lan_ip || '192.168.137.1'
  const joinUrl = `http://${lanIp}:8765/join`
  const ready = Boolean(status?.is_live || (status?.is_connected && status?.hotspot_active))

  async function copyLink() {
    await copyText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Friend join link</h2>
      </div>
      <p className="lead">
        Send this link to friends. On your shared WiFi it opens even without internet,
        so they can log in and enter your code.
      </p>
      {!ready ? (
        <p className="muted">Start sharing first to activate the join link.</p>
      ) : (
        <>
          <div className="wifi-cred">
            <div>
              <span className="muted">Join link</span>
              <strong className="wifi-value join-url">{joinUrl}</strong>
            </div>
            <Button variant="ghost" onClick={copyLink}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p className="muted">
            Friends: join your WiFi → open this link → log in → enter invite code.
          </p>
        </>
      )}
    </section>
  )
}
