// PoolKaro Service Worker
// Handles push notifications and caching

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Handle push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return

  const data = e.data.json()
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: data.actions || [],
    tag: data.tag || 'poolkaro',
    requireInteraction: false,
  }

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'

  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // If app is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
