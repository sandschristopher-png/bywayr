// public/sw.js
const CACHE_NAME = 'bywayr-v3';
const TILE_CACHE_NAME = 'bywayr-tiles-v2';
const IMAGE_CACHE_NAME = 'bywayr-images-v1';

const STATIC_ASSETS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/aviasales.svg',
  '/saily.svg',
  '/kiwi.svg'
];

const TILE_HOSTS = ['basemaps.cartocdn.com', 'tile.openstreetmap.org'];
const IMAGE_HOSTS = ['supabase.co', 'supabase.in'];

const MAX_IMAGE_ENTRIES = 200;
const MAX_TILE_ENTRIES = 800;

// 1. Install: Precache static shell assets safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual puts so a single missing SVG does not break SW installation
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          fetch(asset).then((res) => {
            if (res.ok) return cache.put(asset, res);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate: Prune stale caches
self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, TILE_CACHE_NAME, IMAGE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !keep.includes(name))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Fetch Handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // A. Map Tiles: Stale-While-Revalidate
  if (TILE_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
              trimCache(cache, MAX_TILE_ENTRIES);
            }
            return networkResponse;
          })
          .catch(() => null);

        event.waitUntil(fetchPromise);
        return cachedResponse || fetchPromise || new Response(null, { status: 504 });
      })
    );
    return;
  }

  // B. Supabase Images & Avatars: Cache-First
  if (
    IMAGE_HOSTS.some((host) => url.hostname.includes(host)) &&
    (url.pathname.includes('/storage/') || url.pathname.includes('/object/'))
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            trimCache(cache, MAX_IMAGE_ENTRIES);
          }
          return networkResponse;
        } catch (err) {
          return Response.error();
        }
      })
    );
    return;
  }

  // C. Default: Network-First with Cache Fallback + Navigation Root
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }

        return Response.error();
      })
  );
});

// 4. Cache Trimmer
async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const excess = keys.length - maxEntries + Math.ceil(maxEntries * 0.1);
      for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (err) {}
}