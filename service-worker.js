const CACHE_VERSION = 'hotflash-pwa-v11';
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
  '/home-final.css?v=5',
  '/home-flashtag-premium.css?v=1',
  '/home-final.js?v=3',
  '/shops.css?v=1',
  '/shops.js?v=1',
  '/shop.css?v=1',
  '/shop.js?v=1',
  '/hoon.css?v=4',
  '/hoon.js?v=4',
  '/site-nav.js?v=2',
  '/pwa.js?v=3',
  '/app-version.json',
  '/assets/hot-flash-logo.png',
  '/assets/flashtag-founder-hf000006-vector.svg?v=1'
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

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallback ? caches.match(fallback) : Response.error());
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/offline.html'));
    return;
  }

  const isCodeOrStyle = ['script', 'style', 'worker'].includes(request.destination)
    || /\.(?:js|css|json)$/i.test(url.pathname);

  if (isCodeOrStyle) {
    event.respondWith(networkFirst(request));
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
  if (event.data === 'CLEAR_APP_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }
});
