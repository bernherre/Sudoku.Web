// service-worker.published.js (prod)
// Estrategia: precache de assets + fallback a index.html para rutas SPA.
const CACHE = 'sudoku-blazor-v1';
const ASSETS = self.assetsManifest ? self.assetsManifest.assets.map(a => new URL(a.url, self.location).toString()) : [];
const OFFLINE_FALLBACK = new URL('./index.html', self.location).toString();

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll([OFFLINE_FALLBACK, ...ASSETS]);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const reqUrl = new URL(event.request.url);

    // Solo cachea GET
    if (event.request.method !== 'GET') return;

    // Primero red: si falla, cache
    event.respondWith((async () => {
        try {
            const network = await fetch(event.request);
            // Actualiza cache de assets del manifest
            if (ASSETS.includes(reqUrl.toString())) {
                const cache = await caches.open(CACHE);
                cache.put(event.request, network.clone());
            }
            return network;
        } catch {
            // Fallback SPA: para rutas internas sirve index.html
            if (event.request.mode === 'navigate') {
                const cache = await caches.open(CACHE);
                const offline = await cache.match(OFFLINE_FALLBACK);
                if (offline) return offline;
            }
            // O intenta el recurso cacheado
            const cache = await caches.open(CACHE);
            const cached = await cache.match(event.request);
            if (cached) return cached;
            throw new Error('offline and not cached');
        }
    })());
});
