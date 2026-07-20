export function StatusBadge({ connected }) {
  return (
    <span className={`status-badge ${connected ? 'online' : 'offline'}`}>
      {connected ? 'On' : 'Off'}
    </span>
  )
}
