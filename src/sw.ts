/// <reference lib="webworker" />

// Temporary one-release cache reset for old iOS home-screen metadata.
// This replaces the prior app-shell worker at the same /sw.js path, deletes
// old offline caches that can still contain stale home-screen metadata, refreshes any
// open tab to network HTML, then unregisters itself.

const sw = globalThis as unknown as ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown };

// Referenced only to satisfy vite-plugin-pwa's injectManifest requirement; unused at runtime.
if (Array.isArray(sw.__WB_MANIFEST)) { /* noop */ }

sw.addEventListener("install", () => sw.skipWaiting());

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        await sw.clients.claim();
        const clients = await sw.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await sw.registration.unregister();
      }
    })(),
  );
});