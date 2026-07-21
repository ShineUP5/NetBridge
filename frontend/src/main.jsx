import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function isHelperAppHost() {
  const { hostname, port } = window.location
  return port === '8765' || hostname === '192.168.137.1'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Local helper serves fresh files — SW causes ERR_FAILED when helper restarts.
    if (isHelperAppHost()) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((key) => caches.delete(key)))
        }
      } catch {
        // ignore
      }
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => {})
      })
      .catch(() => {})
  })
}
