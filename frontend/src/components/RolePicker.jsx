const ROLES = [
  {
    id: 'gateway',
    title: 'SERVER',
    description: 'Share internet from this computer',
  },
  {
    id: 'dependant',
    title: 'DEPENDENT',
    description: 'Connect with a friend’s code',
  },
]

export function RolePicker({ value, onChange }) {
  return (
    <div className="role-grid">
      {ROLES.map((role) => (
        <button
          key={role.id}
          type="button"
          className={value === role.id ? 'role active' : 'role'}
          onClick={() => onChange(role.id)}
        >
          <strong>{role.title}</strong>
          <span>{role.description}</span>
        </button>
      ))}
    </div>
  )
}
