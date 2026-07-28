import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PGG Photo Documentation" },
      {
        name: "description",
        content:
          "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#8b5e34" },
      { property: "og:title", content: "PGG Photo Documentation" },
      { property: "og:description", content: "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "PGG Photo Documentation" },
      { name: "twitter:description", content: "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest?v=pgg-3" },
      { rel: "apple-touch-icon", href: "/icon-pgg-v2-192.png?v=pgg-3" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-pgg-v2-192.png?v=pgg-3" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-pgg-v2-512.png?v=pgg-3" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/survey.html"
      title="PGG Photo Documentation"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        border: "none",
        margin: 0,
        padding: 0,
      }}
      allow="camera; geolocation; clipboard-read; clipboard-write"
    />
  );
}
