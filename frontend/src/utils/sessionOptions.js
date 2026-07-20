/** Shared session length options for approve + connected controls. */
export const SESSION_OPTIONS = [
  { value: 0, label: 'No limit' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
]

export function sessionMinutesPayload(value) {
  const minutes = Number(value)
  if (!minutes || minutes <= 0) return null
  return minutes
}
