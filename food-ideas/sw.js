// Dinner Ideas offline helper.
// Strategy: ask the network first (so updates show up right away) and keep a saved copy
// only for when there is no internet or the connection is very slow.
const CACHE = "dinner-ideas-v17";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache:"reload" skips the browser's own 10-minute cache, so the saved copy is always the newest files
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, {cache: "reload"})).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return c.put(f, r); })
  ))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const network = fetch(req, {cache: "no-cache"}).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  e.respondWith((async () => {
    try {
      // use the network, but don't wait more than 4 seconds if we already have a saved copy
      return await Promise.race([network, new Promise((_, no) => setTimeout(no, 4000))]);
    } catch (err) {
      const saved = (await caches.match(req, {ignoreSearch: true})) || (await caches.match("./index.html"));
      return saved || network;
    }
  })());
});
