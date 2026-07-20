import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function Brand({
  className = '',
  to = '/',
  showWordmark = true,
  size = 'md',
}) {
  const logoSize = size === 'lg' ? 52 : size === 'sm' ? 28 : 38

  const content = (
    <span className={`brand-lockup brand-${size} ${className}`.trim()}>
      <span className="brand-mark" aria-hidden="true">
        <Logo size={logoSize} />
      </span>
      {showWordmark ? (
        <span className="brand-text">
          Net<span>Bridge</span>
        </span>
      ) : null}
    </span>
  )

  if (to === null || to === false) {
    return <div className="brand brand-static">{content}</div>
  }

  return (
    <Link to={to} className="brand-link" aria-label="NetBridge home">
      {content}
    </Link>
  )
}
