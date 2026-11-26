// Offline support: cache the app shell, serve it first, refresh in the background.
const CACHE = "my-day-v8";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const host = new URL(e.request.url).hostname;
  // Only same-origin files and fonts are cached; weather and other API calls always go to the network.
  if (host !== self.location.hostname && !/(^|\.)(googleapis|gstatic)\.com$/.test(host)) return;
  // Event data: always try the network first so it stays fresh, fall back to the last copy offline.
  if (new URL(e.request.url).pathname.endsWith("/upcoming.json")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request, {ignoreSearch: true})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok || res.type === "opaque") caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
