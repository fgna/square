/* Privacy-first offline navigation fallback. No user-specific responses are cached. */
'use strict';
const CACHE_NAME = 'community-offline-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL, '/offline.css']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('community-offline-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only full-page GET navigations are handled. API/data/subresource requests
  // go straight to the network and are never stored by this worker.
  if (request.method !== 'GET') return;
  // Only this anonymous stylesheet may be returned from cache offline.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname === '/offline.css') {
    event.respondWith(caches.open(CACHE_NAME).then((cache) =>
      cache.match('/offline.css').then((cached) => cached || fetch(request))
    ));
    return;
  }
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) ||
        new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })
  );
});
