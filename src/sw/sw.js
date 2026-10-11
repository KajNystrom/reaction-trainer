/* Service worker template. The build replaces the two placeholders below
 * (see swPlugin in vite.config.ts); paths are relative to the SW scope, so
 * the app works from any sub-path such as /reaction-trainer/ on GitHub Pages. */
const VERSION = '__SW_VERSION__';
const PRECACHE = __SW_PRECACHE__;
const CACHE = `reaction-trainer-${VERSION}`;

const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map(scoped)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('reaction-trainer-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first: the app is fully static, and a new deploy changes this file,
// which installs a new SW with a fresh cache. ignoreVary: module scripts are
// requested with an Origin header while precached entries were not, so a
// `Vary: Origin` response header would otherwise make every lookup miss.
const MATCH = { cacheName: CACHE, ignoreVary: true };
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(scoped('./'), MATCH).then((hit) => hit ?? fetch(req)),
    );
    return;
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit ?? fetch(req)));
});
