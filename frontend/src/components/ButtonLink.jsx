import { Link } from 'react-router-dom'

export function ButtonLink({ to, children, variant = 'primary', className = '' }) {
  return (
    <Link to={to} className={`btn ${variant} ${className}`.trim()}>
      {children}
    </Link>
  )
}
