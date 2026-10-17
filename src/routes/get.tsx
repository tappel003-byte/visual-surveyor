import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/get")({
  validateSearch: (search: Record<string, unknown>) => ({
    job: typeof search.job === "string" ? search.job : "",
  }),
  head: () => ({
    meta: [
      { title: "Download link retired — PGG" },
      {
        name: "description",
        content: "Old public download links are turned off. Use password-gated /office instead.",
      },
      { property: "og:title", content: "Download link retired — PGG" },
      {
        property: "og:description",
        content: "Sign in at /office with the company password to download synced jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetExportRetired,
});

/** Public anon /get downloads are retired — desk uses token/sign via /office. */
function GetExportRetired() {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#1f1b16",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 10, fontWeight: 700 }}>This download link is retired</h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: "#6b6357", margin: "0 0 16px" }}>
        Old share links no longer download jobs. Sign in at{" "}
        <strong style={{ color: "#1f1b16" }}>/office</strong> with the company password, open the job,
        and use <strong style={{ color: "#1f1b16" }}>Download</strong> or{" "}
        <strong style={{ color: "#1f1b16" }}>Download package</strong> from File Explorer.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6b6357", margin: "0 0 24px" }}>
        Photos stay in office staging until someone downloads them and deletes the job there.
      </p>
      <Link
        to="/office"
        style={{
          display: "inline-block",
          padding: "12px 18px",
          borderRadius: 10,
          background: "#8b5e34",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          textDecoration: "none",
        }}
      >
        Go to /office
      </Link>
      <p style={{ marginTop: 20 }}>
        <a href="/" style={{ color: "#8b5e34", fontWeight: 600, fontSize: 14 }}>
          ← Field home
        </a>
      </p>
    </div>
  );
}
