import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/survey.html" });
  },
  head: () => ({
    meta: [
      { title: "PGG" },
      {
        name: "description",
        content:
          "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#8b5e34" },
      { property: "og:title", content: "PGG" },
      { property: "og:description", content: "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "PGG" },
      { name: "twitter:description", content: "PGG field photo documentation tool for floor plan pins, room locations, notes, photos, and export." },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "PGG" },
      { name: "application-name", content: "PGG" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-pgg.webmanifest?v=pgg-6" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=pgg-6" },
      { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon-precomposed.png?v=pgg-6" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon.png?v=pgg-6" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-pgg-v2-512.png?v=pgg-6" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
      <a className="text-lg font-semibold underline" href="/survey.html">
        Open PGG
      </a>
    </main>
  );
}
