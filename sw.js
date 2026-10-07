const CACHE = 'ironfront-v1';

const ASSETS = [
  './',
  './index.html',
  './modificaciones/mods.json',
  './modificaciones/pwa_offline.js',
  './modificaciones/camiones.js',
  './modificaciones/aire_conquista.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
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
  if (req.url.includes('api.github.com')) {
    e.respondWith(fetch(req).catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === 'opaque')) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return r;
    }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 })))
  );
});
