/**
 * DayOS service worker.
 *
 * Deliberately minimal: it precaches the icons and serves an offline page when
 * a navigation fails. It does NOT cache pages or data — DayOS is about what is
 * true right now, and a stale schedule is worse than an honest "you're
 * offline".
 */

const CACHE = "dayos-shell-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  if (request.destination === "image" && new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request)),
    );
  }
});
