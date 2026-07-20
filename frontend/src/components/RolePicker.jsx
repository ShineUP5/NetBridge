const ROLES = [
  {
    id: 'gateway',
    title: 'I share',
    description: 'Share internet from my computer',
  },
  {
    id: 'dependant',
    title: 'I join',
    description: 'Join a friend’s shared internet',
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
