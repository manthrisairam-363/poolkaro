// CarpoolKaro Service Worker v3
// Push notifications + offline caching

const CACHE_NAME = 'carpoolkaro-v3'
const OFFLINE_URL = '/'

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

// Install — cache core assets
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
  )
})

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Only handle GET requests for our origin
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  // Skip Supabase API calls
  if (e.request.url.includes('supabase.co')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful responses for app shell
        if (response.ok && (e.request.url.endsWith('/') || e.request.url.includes('.png') || e.request.url.includes('.js') || e.request.url.includes('.css'))) {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned))
        }
        return response
      })
      .catch(() => {
        // Offline fallback — return cached version
        return caches.match(e.request) || caches.match(OFFLINE_URL)
      })
  )
})

// Push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-512.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      actions: data.actions || [],
      tag: data.tag || 'carpoolkaro',
      requireInteraction: false,
    })
  )
})

// Notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
