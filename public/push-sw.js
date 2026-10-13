// Service worker addendum: handler Web Push (di-import workbox via importScripts).
// Payload dari Edge Function `send-push`: { title, body, url, sound, tag }.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Sa7tein', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sa7tein', {
      body: data.body || '',
      icon: '/icons/sa7tein-192x192.png',
      badge: '/icons/sa7tein-72x72.png',
      tag: data.tag,
      renotify: true,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
