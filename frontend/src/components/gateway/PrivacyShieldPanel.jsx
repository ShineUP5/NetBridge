export function PrivacyShieldPanel({ status }) {
  if (!status) return null

  const active = Boolean(status.privacy_shield_active || status.nat_active)
  const friendsInternetOnly = Boolean(status.client_isolation_active)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Your account link</h2>
        <span className={`status-badge ${active ? 'online' : 'offline'}`}>
          {active ? 'All set' : 'Not ready'}
        </span>
      </div>
      <p className="lead">
        Your voucher stays on this computer. Friends use your shared WiFi, not the
        voucher WiFi.
      </p>
      <ul className="facts compact">
        <li>
          <strong>Linked device</strong>
          <span>{status.hostname || status.device_name || 'This PC'}</span>
        </li>
        <li>
          <strong>Friends can use</strong>
          <span>Internet only</span>
        </li>
        <li>
          <strong>Your files</strong>
          <span>{friendsInternetOnly ? 'Protected' : 'Start sharing to protect'}</span>
        </li>
        <li>
          <strong>Status</strong>
          <span>{active ? 'Sharing safely' : 'Waiting to start'}</span>
        </li>
      </ul>
      <p className="muted">
        Friends only get internet. They cannot open files or folders on this computer.
      </p>
    </section>
  )
}
