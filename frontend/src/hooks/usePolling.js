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
    let id = null

    async function tick() {
      if (cancelled || inFlight.current) return
      if (typeof document !== 'undefined' && document.hidden) return
      inFlight.current = true
      try {
        await saved.current()
      } finally {
        inFlight.current = false
      }
    }

    function start() {
      if (id) clearInterval(id)
      tick()
      id = setInterval(tick, intervalMs)
    }

    function onVisibility() {
      if (!document.hidden) tick()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}
