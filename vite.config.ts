// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // wrapper module is the only registrar
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        devOptions: { enabled: false },
        injectManifest: {
          swDest: resolve(process.cwd(), "dist/sw.js"),
          // Precache hashed JS/CSS/assets only. HTML is fetched network-first
          // so deploys are visible immediately; the SW caches the latest HTML
          // for offline fallback on first visit.
          globPatterns: ["**/*.{js,css,ico,png,svg,webmanifest}"],
          globIgnores: ["**/node_modules/**", "**/*.map", "sw.js", "workbox-*.js"],
          // TanStack Start emits `client/` and `server/` subdirs, but the
          // deployed origin serves those files at the root. Rewrite the
          // precache manifest so cached URLs match what the browser fetches.
          manifestTransforms: [
            async (entries) => {
              const manifest = entries
                .filter((e) => !e.url.startsWith("server/"))
                .map((e) =>
                  e.url.startsWith("client/")
                    ? { ...e, url: e.url.slice("client/".length) }
                    : e,
                );
              return { manifest, warnings: [] };
            },
          ],
          additionalManifestEntries: [
            // `/` is the React shell route; precache it so the root loads offline.
            { url: "/", revision: null },
          ],
        },
      }),
    ],
  },
});
