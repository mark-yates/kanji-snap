const CACHE_NAME = "kanji-snap-v42.3";
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

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
  "./js/kanji-picker.js",

  "./data/grade-1.json",
  "./data/grade-2.json",
  "./data/grade-3.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isMeaningImage(url){
  return url.origin === location.origin &&
         url.pathname.includes("/images/meaning/") &&
         url.pathname.endsWith(".png");
}

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if(url.origin !== location.origin) return;

  // Navigations -> cached index.html
  if(req.mode === "navigate"){
    event.respondWith((async () => {
      const cached = await caches.match("./index.html");
      return cached || fetch(req);
    })());
    return;
  }

  // Meaning images:
  // - normal requests: CACHE ONLY (game never goes online)
  // - download requests (?dl=1): allow network, but store under canonical URL (no query)
  if(isMeaningImage(url)){
    const isDownload = url.searchParams.get("dl") === "1";

    if(!isDownload){
      event.respondWith((async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const canonical = url.pathname; // no query
        const hit = (await cache.match(canonical)) || (await cache.match(url.pathname)) || (await cache.match(url.href));
        return hit || new Response("", { status: 404 });
      })());
      return;
    }

    // Download mode
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const canonicalReq = new Request(url.pathname, { method: "GET" });

      try{
        const res = await fetch(req);
        if(res && res.ok){
          await cache.put(canonicalReq, res.clone());
          return res;
        }
        return new Response("", { status: res?.status || 500 });
      } catch {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }

  // Everything else: cache-first, then network, and store in runtime cache
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if(cached) return cached;

    try{
      const res = await fetch(req);
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
      return res;
    } catch {
      return new Response("", { status: 504 });
    }
  })());
});


