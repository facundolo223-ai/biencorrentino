// =============================================================
// R&S MARKET POS - Service Worker (PWA Offline & Cache)
// =============================================================
const CACHE_NAME = 'rsmarket-pos-v3';
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/manifest.json'
];

// Instalar: pre-cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network First para API, Cache First para assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls → siempre intentar red primero
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Sin conexión al servidor. Verificá que la PC esté encendida.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Assets estáticos → Cache first, luego red
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Actualizar cache en background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
