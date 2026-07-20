import { useEffect, useRef } from 'react'

export function usePolling(callback, intervalMs, enabled = true) {
  const saved = useRef(callback)
  const inFlight = useRef(false)

  useEffect(() => {
    saved.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    async function tick() {
      if (cancelled || inFlight.current) return
      inFlight.current = true
      try {
        await saved.current()
      } finally {
        inFlight.current = false
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs, enabled])
}
