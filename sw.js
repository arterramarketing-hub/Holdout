// Holdout's service worker, for the installed app. tools/build.py fills in the version and the file list.
// After one launch online the game starts with no connection. The page itself is network first (4 s, then the saved
// copy), so anyone online always gets the newest build; three.js and the font files are cache first, since their
// URLs are versioned; the font stylesheet comes from the cache while a fresh copy is fetched. A new build takes
// over at once and deletes the old cache.
const CACHE = 'holdout-303e0c663a7d';
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];
const ENGINE = ['https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.core.js',
  'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await Promise.all(ENGINE.map(url => cache.add(new Request(url, { mode: 'cors' })).catch(() => {})));   // the engine too, if the CDN answers now
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('holdout-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request, saveAs) {
  const cache = await caches.open(CACHE);
  let timer = null;
  try {
    const response = await Promise.race([fetch(request), new Promise((_, fail) => { timer = setTimeout(() => fail(new Error('slow network')), 4000); })]);
    if (!response.ok) throw new Error('status ' + response.status);   // a deploy in flight answers 404: the saved copy is better than an error page
    cache.put(saveAs || request, response.clone());
    return response;
  } catch (e) {
    return (await cache.match(saveAs || request, { ignoreSearch: true })) || Response.error();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fresh = fetch(request).then(response => {
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  }).catch(() => hit || Response.error());
  return hit || fresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') event.respondWith(networkFirst(request, new URL('./index.html', self.registration.scope).href));
  else if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(request));
  else if (url.hostname === 'fonts.googleapis.com') event.respondWith(staleWhileRevalidate(request));
});
