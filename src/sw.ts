/// <reference lib="webworker" />
// Custom service worker source used by vite-plugin-pwa's injectManifest strategy.
// Workbox injects the precache manifest into self.__WB_MANIFEST at build time.

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const OFFLINE_SHELL = "/survey.html";
const OFFLINE_CACHE = "offline-shell-v1";

// Precache hashed JS/CSS/assets only. HTML is fetched network-first so
// deploys are visible immediately, then cached for offline fallback.
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Always keep a fresh offline copy of the visible shell.
async function cacheOfflineShell() {
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const response = await fetch(OFFLINE_SHELL, { cache: "no-cache" });
    if (response && response.ok) {
      await cache.put(OFFLINE_SHELL, response.clone());
    }
  } catch {}
}

// HTML navigations — NetworkFirst so users get fresh HTML online,
// fall back to cached shell offline.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    !url.pathname.startsWith("/~oauth") &&
    !url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "html-navigations",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 32 })],
  }),
);

// Same-origin built assets (hashed JS/CSS/worker) — cache-first for
// instant offline cold-start of the app shell.
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "worker") &&
    !url.pathname.startsWith("/~oauth") &&
    !url.pathname.startsWith("/api/"),
  new CacheFirst({
    cacheName: "app-shell-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 128 })],
  }),
);

// survey.html loads jszip/jspdf from jsdelivr — cache them so the shell
// works offline for export flows.
registerRoute(
  ({ url }) =>
    url.origin === "https://cdn.jsdelivr.net" &&
    (url.pathname.includes("jszip") || url.pathname.includes("jspdf")),
  new CacheFirst({
    cacheName: "cdn-libs",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 }),
    ],
  }),
);

// Offline navigation fallback — serve the cached survey shell.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const htmlCache = await caches.open("html-navigations");
    const cached =
      (await htmlCache.match("/survey.html")) ||
      (await htmlCache.match("/"));
    if (cached) return cached;

    const offlineCache = await caches.open(OFFLINE_CACHE);
    const shell = await offlineCache.match(OFFLINE_SHELL);
    if (shell) return shell;
  }
  return Response.error();
});

// Activate new versions promptly.
self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflineShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Legacy: still honor an explicit SKIP_WAITING message if anything sends one.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
