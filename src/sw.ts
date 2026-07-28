/// <reference lib="webworker" />

// Temporary one-release cache reset for old iOS home-screen metadata.
// This replaces the prior app-shell worker at the same /sw.js path, deletes
// old offline caches that can still contain `tanstack_start_ts`, refreshes any
// open tab to network HTML, then unregisters itself.

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});