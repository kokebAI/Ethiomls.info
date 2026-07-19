/* EthioMLS — lightweight SW for Chromium installability + shell caching. */
const CACHE_NAME = "ethiomls-shell-v2";
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(
          PRECACHE_URLS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: "reload" });
              if (response.ok) await cache.put(url, response);
            } catch {
              // Skip failed assets — never block install.
            }
          }),
        );
      } finally {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Required fetch handler so Chrome considers the app installable. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never intercept API/auth — keep live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  event.respondWith(
    (async () => {
      if (request.mode === "navigate") {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(request);
          return (
            cached ||
            caches.match("/am") ||
            new Response("EthioMLS is offline. Reconnect and retry.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      }

      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok && url.pathname.startsWith("/icons/")) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return (
          cached ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});
