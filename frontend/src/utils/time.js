export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, totalSeconds)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function secondsUntil(isoDate) {
  if (!isoDate) return 0
  return Math.max(0, Math.floor((new Date(isoDate) - Date.now()) / 1000))
}
