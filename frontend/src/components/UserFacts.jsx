export function UserFacts({ user }) {
  return (
    <ul className="facts">
      <li>
        <strong>Phone</strong> {user.phone}
      </li>
      <li>
        <strong>Email</strong> {user.email}
      </li>
      <li>
        <strong>Role</strong> {user.role === 'gateway' ? 'Gateway' : 'Dependant'}
      </li>
    </ul>
  )
}
