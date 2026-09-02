const CACHE_VERSION = 'oni-hub-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const BASE_URL = new URL('./', self.registration.scope);
const asset = path => new URL(path, BASE_URL).toString();
const APP_SHELL = ['', 'index.html', 'offline.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'].map(asset);

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(fallback));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const update = fetch(request).then(async response => {
    if (isCacheable(response)) (await caches.open(RUNTIME_CACHE)).put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) return cached;
  return (await update) || Response.error();
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => ![SHELL_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, asset('offline.html')));
    return;
  }

  if (['script', 'style', 'image', 'font', 'audio'].includes(request.destination)) event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
