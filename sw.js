/* ============================================================
   SERVICE WORKER — Ironfront RTS
   - Mods y HTML: network-first (se actualizan solos con internet)
   - CDNs y estáticos: cache-first (rápido y offline)
   ============================================================ */
const CACHE = 'ironfront-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './modificaciones/mods.json',
  './modificaciones/pwa_offline.js',
  './modificaciones/camiones.js',
  './modificaciones/aire_conquista.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

// Patrones que SIEMPRE deben revalidarse contra la red
const NETWORK_FIRST = [
  /modificaciones\/.*\.(js|json)$/i,
  /\/index\.html$/i,
  /\/sw\.js$/i,
  /\/mods\/.*\.(js|json)$/i,
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRECACHE.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = req.url;

  // GitHub API: siempre red, fallback vacío
  if (url.includes('api.github.com')) {
    e.respondWith(fetch(req).catch(() =>
      new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  const isNetworkFirst = NETWORK_FIRST.some(rx => rx.test(url));

  if (isNetworkFirst) {
    // Network-first: intenta red, si falla usa caché
    e.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para todo lo demás (CDNs, imágenes, etc.)
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 }));
    })
  );
});

// Permite forzar actualización desde la página
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
  }
});
