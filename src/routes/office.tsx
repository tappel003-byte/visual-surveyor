import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { officeAuthStatus, officeLogin, officeLogout } from "@/lib/office-auth.functions";

export const Route = createFileRoute("/office")({
  head: () => ({
    meta: [
      { title: "PGG Office — File Explorer" },
      {
        name: "description",
        content: "Password-protected office file explorer for synced PGG field jobs (staging).",
      },
    ],
  }),
  loader: async () => officeAuthStatus(),
  component: OfficeExplorer,
});

function OfficeExplorer() {
  const initial = Route.useLoaderData();
  const [auth, setAuth] = useState(initial);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setAuth(await officeAuthStatus());
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await officeLogin({ data: { password } });
      setPassword("");
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await officeLogout();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const shell = {
    maxWidth: 720,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "system-ui, sans-serif",
    color: "#2c241b",
  } as const;

  if (!auth.configured) {
    return (
      <div style={shell}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>PGG Office File Explorer</h1>
        <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5 }}>
          Stage A shell is deployed, but this Netlify site has not been given office credentials yet.
          In Netlify → Site settings → Environment variables, add{" "}
          <code>NLF_OFFICE_PASSWORD</code> (shared company password) and{" "}
          <code>NLF_SESSION_SECRET</code> (random string, at least 16 characters), then redeploy.
        </p>
        <p style={{ fontSize: 13, color: "#6b5d4f", marginTop: 16 }}>
          Field app stays passwordless. Existing Export and <code>/get?job=</code> links are unchanged.
        </p>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div style={shell}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>PGG Office File Explorer</h1>
        <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, marginBottom: 20 }}>
          Company password required. This page is the www middleman for downloading synced jobs to PGG
          servers — not the field survey app.
        </p>
        <form onSubmit={onLogin}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Office password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 320,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d4c8b8",
              fontSize: 15,
            }}
          />
          {error && (
            <p style={{ color: "#a33", fontSize: 13, marginTop: 10 }} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            style={{
              marginTop: 14,
              padding: "12px 20px",
              border: 0,
              borderRadius: 10,
              background: "#7a4b2a",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>PGG Office File Explorer</h1>
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
            Staging middleman (Supabase behind this UI in later stages). Download confirmed jobs to your
            chosen folder, then save to PGG servers.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          style={{
            padding: "8px 12px",
            border: "1px solid #7a4b2a",
            borderRadius: 8,
            background: "#fff",
            color: "#7a4b2a",
            fontSize: 13,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Sign out
        </button>
      </header>

      <section
        style={{
          border: "1px dashed #d4c8b8",
          borderRadius: 12,
          padding: "20px 18px",
          background: "#faf7f2",
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Stage A — shell only</h2>
        <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
          You are signed in. Job folders from field <strong>Sync</strong> will list here in Stage B.
          Per-job download actions arrive in Stage C. Cloudflare DNS for{" "}
          <code>www.pggphotodocumentation.com</code> can point at this Netlify site whenever Tim is
          ready — the app works on the default <code>*.netlify.app</code> URL today.
        </p>
      </section>

      <p style={{ fontSize: 12, color: "#8a7a68", marginTop: 20 }}>
        Export on the phone and <code>/get?job=</code> remain fully available until Tim retires them
        after NLF is verified.
      </p>
    </div>
  );
}
