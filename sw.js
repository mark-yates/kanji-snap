/* sw.js */

const CACHE_NAME = "kanji-snap-cache-v1.v62";      // bump for app shell updates
const RUNTIME_CACHE = "kanji-snap-runtime-v1"; // must match settings.js/game-quiz.js

// Precache the core app shell + data needed for initial run/offline
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./sw.js",

  // JS entry + modules (include what your app imports)
  "./js/app.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/settings.js",
  "./js/data.js",
  "./js/game-quiz.js",
  "./js/words.js",

  // Optional modules (safe to include if present; if not present, remove)
  "./js/dictionary.js",
  "./js/kanji-picker.js",

  // Grade data (adjust list if your repo differs)
  "./data/grade-1.json",
  "./data/grade-2.json",
  "./data/grade-3.json",

  // ✅ NEW words dataset
  "./data/words.v2.csv",
];

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin (keeps behavior predictable)
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    // Cache-first for app shell and previously fetched resources
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      // Cache successful same-origin GETs into runtime cache
      if (res && res.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      }

      return res;
    } catch (err) {
      // Navigation fallback for offline
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
