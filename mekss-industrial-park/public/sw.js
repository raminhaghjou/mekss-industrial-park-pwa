const CACHE_NAME = 'mekss-industrial-park-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- Push Notification Logic ---

// Listen for push events
self.addEventListener('push', (event) => {
  const data = event.data.json(); // Assuming the server sends a JSON payload
  console.log('Push received:', data);

  const title = data.title || 'Mekss Industrial Park';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png', // Icon for the notification tray
    data: {
        url: data.url || '/' // URL to open when notification is clicked
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  // Open the app or a specific URL
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
