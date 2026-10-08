/* ============================================================
   SERVICE WORKER — Ironfront RTS
   - Mods y HTML: network-first (se actualizan solos con internet)
   - CDNs y estáticos: cache-first (rápido y offline)
   ============================================================ */
const CACHE = 'ironfront-v8';   // subir número cada vez que cambie el SW

const PRECACHE = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './mods/modos_juego.js',
  './mods/mapa_ciudad.js',
  './mods/mods_fix.js',
  './icon.svg',
  './mods/mods.json',
  './mods/pwa_offline.js',
  './mods/DLC.js',
  './mods/mejora_mundo.js',
  './mods/casas.js',
  './mods/ia_mejorada.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

const NETWORK_FIRST = [
  /mods\/.*\.(js|json)$/i,
  /modificaciones\/.*\.(js|json)$/i,   // compatibilidad si algún día vuelve el nombre
  /\/index\.html$/i,
  /\/game\.js$/i,                      // el juego principal: siempre la versión nueva
  /\/manifest\.json$/i,
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

  // GitHub API: siempre red, fallback vacío
  if (req.url.includes('api.github.com')) {
    e.respondWith(fetch(req).catch(() =>
      new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  const isNetworkFirst = NETWORK_FIRST.some(rx => rx.test(req.url));

  if (isNetworkFirst) {
    e.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(req).then(h => h || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para todo lo demás (CDNs, imágenes, etc.)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp && (resp.status === 200 || resp.type === 'opaque')) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 })))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
  }
});