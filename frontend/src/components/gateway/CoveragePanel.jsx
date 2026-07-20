export function CoveragePanel({ status }) {
  if (!status) return null

  const sharing = Boolean(status.is_connected && status.hotspot_active)
  const optimized = Boolean(status.coverage_optimized)
  const band = status.hotspot_band || (sharing ? 'Auto' : '—')

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Coverage</h2>
        <span className={`status-badge ${sharing && optimized ? 'online' : sharing ? 'online' : 'offline'}`}>
          {sharing ? (optimized ? 'Max range' : 'Sharing') : 'Off'}
        </span>
      </div>
      <ul className="facts compact">
        <li>
          <strong>WiFi band</strong>
          <span>{band}</span>
        </li>
        <li>
          <strong>Typical indoor reach</strong>
          <span>~15–30 m / a few rooms</span>
        </li>
        <li>
          <strong>Best setup</strong>
          <span>PC raised, central, few walls</span>
        </li>
      </ul>
    </section>
  )
}
