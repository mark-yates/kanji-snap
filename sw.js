const CACHE_NAME = "kanji-snap-v16";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./sw.js",

  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",

  "./fonts/my-font.ttf",

  "./js/app.js",
  "./js/state.js",
  "./js/data.js",
  "./js/words.js",
  "./js/settings.js",
  "./js/ui.js",
  "./js/game-quiz.js",
  "./js/dictionary.js",

  "./grade-1.json",
  "./grade-2.json",
  "./grade-3.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(
      cached => cached || fetch(event.request)
    )
  );
});

