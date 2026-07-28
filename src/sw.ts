/// <reference lib="webworker" />

// Temporary one-release cache reset for old iOS home-screen metadata.
// This replaces the prior app-shell worker at the same /sw.js path, deletes
// old offline caches that can still contain stale home-screen metadata, refreshes any
// open tab to network HTML, then unregisters itself.

const sw = globalThis as unknown as ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Reference the injectManifest token so vite-plugin-pwa can inject; unused at runtime.
// The literal `self.__WB_MANIFEST` string must appear in source for workbox-build.
const _precacheManifest = (self as unknown as { __WB_MANIFEST: unknown[] }).__WB_MANIFEST;
if (_precacheManifest.length < 0) {
  // unreachable, keeps the reference from being tree-shaken
  console.log(_precacheManifest);
}

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
