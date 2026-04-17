// ─────────────────────────────────────────────────────────────────
// service-worker.js
// Uppdatera CACHE_VERSION vid varje ny deploy så gamla cacher rensas
// ─────────────────────────────────────────────────────────────────
const CACHE_VERSION = 'v1.4';
const CACHE_NAME    = `sl-avgangstavla-${CACHE_VERSION}`;

// Filer som cachas vid installation (app-skalet)
const PRECACHE_URLS = [
  '/sl-avgangstavla/',
  '/sl-avgangstavla/index.html',
  '/sl-avgangstavla/manifest.json',
];

// ── Install: cacha app-skalet ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  // Aktivera ny SW direkt utan att vänta på att gamla flikar stängs
  self.skipWaiting();
});

// ── Activate: rensa gamla cacher ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('sl-avgangstavla-') && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Rensar gammal cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Ta över alla öppna flikar omedelbart
  self.clients.claim();
});

// ── Fetch: network-first för API, cache-first för app-skal ────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // SL:s API:er – alltid hämta från nätet, aldrig cacha
  const isApiCall =
    url.hostname.includes('transport.integration.sl.se') ||
    url.hostname.includes('journeyplanner.integration.sl.se') ||
    url.hostname.includes('deviations.integration.sl.se') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isApiCall) {
    // Network-only för API-anrop
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Cache-first för app-skalet (HTML, manifest, SW själv)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cacha lyckade GET-requests för app-filer
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
