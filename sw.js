/* sw.js */

const CACHE_NAME = "kanji-snap-cache-v1.87";      // bump for app shell updates
const RUNTIME_CACHE = "kanji-snap-runtime-v1"; // must match settings.js/game-quiz.js


// Precache the core app shell + data needed for initial run/offline
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./sw.js",

  "./js/app.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/settings.js",
  "./js/data.js",
  "./js/game-quiz.js",
  "./js/words.js",

  "./js/dictionary.js",
  "./js/kanji-picker.js",
  "./js/demo.js",

  "./data/grade-1.json",
  "./data/grade-2.json",
  "./data/grade-3.json",

  // Words dataset
  "./data/words.v2.csv",
];

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      PRECACHE_URLS.map(async (url) => {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] Precache failed:", url, err);
        }
      })
    );

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

function isMeaningImagePath(pathname) {
  // Match your meaning image location
  return pathname.includes("/images/meaning/cartoon/") && pathname.endsWith(".webp");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    // ✅ Special handling: when downloading meaning images (often with ?dl=1),
    // store them in runtime cache under the *pathname only* so the game can find them.
    const isMeaning = isMeaningImagePath(url.pathname);
    const isDownload = url.searchParams.has("dl");

    if (isMeaning && isDownload) {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          // Normalize key: store under pathname (no query string)
          await cache.put(url.pathname, res.clone());
        }
        return res;
      } catch (err) {
        // If offline and not cached, fall back to cache
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        throw err;
      }
    }

    // For meaning images generally, also try runtime cache by pathname first
    if (isMeaning) {
      const cache = await caches.open(RUNTIME_CACHE);
      const hit = await cache.match(url.pathname);
      if (hit) return hit;

      // If not in runtime cache, fall back to normal cache/network behavior
      // (Game won't fetch them, but other views might.)
    }

    // Default: cache-first (app shell + previously fetched)
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      // Cache successful same-origin GETs into runtime cache using the *request* as key
      if (res && res.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(req, res.clone());
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







