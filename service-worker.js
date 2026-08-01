const CACHE_VERSION = 'hotflash-pwa-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/privacy.html',
  '/terms.html',
  '/shops.html',
  '/shop.html',
  '/hoon.html',
  '/styles.css',
  '/app-pages.css',
  '/final-theme.css?v=2',
  '/legal.css?v=1',
  '/home-final.css?v=3',
  '/home-final.js?v=3',
  '/shops.css?v=1',
  '/shops.js?v=1',
  '/shop.css?v=1',
  '/shop.js?v=1',
  '/hoon.css?v=1',
  '/hoon.js?v=1',
  '/site-nav.js?v=2',
  '/assets/hot-flash-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});