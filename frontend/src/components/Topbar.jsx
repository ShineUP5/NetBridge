import { Brand } from './Brand'
import { Button } from './Button'

function roleLabel(role) {
  if (role === 'gateway') return 'Sharing'
  if (role === 'dependant') return 'Joining'
  return role
}

export function Topbar({ user, onLogout }) {
  return (
    <header className="topbar">
      <Brand to={user?.role === 'dependant' ? '/join' : '/'} size="sm" />
      <div className="topbar-meta">
        <span className="topbar-user">
          <span className="topbar-name">{user?.full_name || user?.phone}</span>
          <span className="topbar-role">{roleLabel(user?.role)}</span>
        </span>
        <Button variant="ghost" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </header>
  )
}
