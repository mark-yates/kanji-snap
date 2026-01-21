/* sw.js */

const CACHE_NAME = "kanji-snap-cache-v1.60";          // bump when deploying changes
const RUNTIME_CACHE = "kanji-snap-runtime-v1";     // runtime cache (images, etc.)

// App shell + data we want available offline immediately
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",

  "./js/app.js",

  // Your JS modules (add/remove as needed — leaving these minimal is fine)
  "./js/game-quiz.js",
  "./js/settings.js",
  "./js/words.js",

  // Grade data (adjust if your repo uses different filenames)
  "./data/grade-1.json",
  "./data/grade-2.json",
  "./data/grade-3.json",
  "./data/grade-4.json",
  "./data/grade-5.json",
  "./data/grade-6.json",

  // ✅ NEW: words dataset
  "./data/words.v2.csv",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only cache same-origin requests (keeps things predictable)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      // Cache-first for app shell + data
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req);

        // Cache successful same-origin GETs
        if (res && res.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // If offline and not cached, last resort: try returning index for navigations
        if (req.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
