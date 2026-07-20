/* NetBridge offline shell — keeps join/dependant pages available without internet */
const CACHE = 'netbridge-v3'
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

function isAssetRequest(pathname) {
  return /\.(js|mjs|css|map|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|webmanifest)$/i.test(pathname)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache API / helper control — always network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/status') ||
    url.pathname.startsWith('/connect') ||
    url.pathname.startsWith('/disconnect') ||
    url.pathname.startsWith('/ensure-wifi')
  ) {
    return
  }

  // JS/CSS assets: network only — never fall back to HTML (MIME module errors)
  if (isAssetRequest(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      }),
    )
    return
  }

  // HTML / app routes: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))),
  )
})
