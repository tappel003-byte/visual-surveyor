import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { officeAuthStatus, officeLogin, officeLogout } from "@/lib/office-auth.functions";
import { officeListJobs, type OfficeJobListResult } from "@/lib/office-jobs.functions";

export const Route = createFileRoute("/office/")({
  head: () => ({
    meta: [
      { title: "PGG Office — File Explorer" },
      {
        name: "description",
        content: "Password-protected office file explorer for synced PGG field jobs (staging).",
      },
    ],
  }),
  loader: async () => {
    const auth = await officeAuthStatus();
    let jobs: OfficeJobListResult | null = null;
    if (auth.authenticated) {
      try {
        jobs = await officeListJobs();
      } catch {
        jobs = { listAvailable: false, jobs: [] };
      }
    }
    return { auth, jobs };
  },
  component: OfficeExplorer,
});

function formatSizeMb(totalBytes: number): string {
  const mb = totalBytes / (1024 * 1024);
  if (mb < 0.01 && totalBytes > 0) return "<0.01 MB";
  return `${mb.toFixed(2)} MB`;
}

function OfficeExplorer() {
  const { auth: initialAuth, jobs: initialJobs } = Route.useLoaderData();
  const [auth, setAuth] = useState(initialAuth);
  const [jobs, setJobs] = useState<OfficeJobListResult | null>(initialJobs);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const reloadJobs = async () => {
    setListError(null);
    setListRefreshing(true);
    try {
      setJobs(await officeListJobs());
    } catch {
      setListError("Could not refresh the job list. Try again in a moment.");
    } finally {
      setListRefreshing(false);
    }
  };

  const refresh = async () => {
    const nextAuth = await officeAuthStatus();
    setAuth(nextAuth);
    if (nextAuth.authenticated) {
      await reloadJobs();
    } else {
      setJobs(null);
    }
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

  const jobList = jobs?.jobs ?? [];
  const listReady = jobs?.listAvailable ?? false;

  return (
    <div style={shell}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>PGG Office File Explorer</h1>
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
            Staging middleman — synced field jobs in shared storage. Use <strong>Open</strong> to browse
            photos and download individual files (large jobs). Legacy <code>/get?job=</code> ZIP links still work.
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

      {!listReady && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 12,
            padding: "18px 16px",
            background: "#fff8f0",
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
            Job list is unavailable. Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in
            Netlify environment variables (server-only — same Supabase project as Export/Sync), then redeploy. See{" "}
            <code>docs/nlf-office-env.md</code>.
          </p>
        </section>
      )}

      {listReady && jobList.length === 0 && (
        <section
          style={{
            border: "1px dashed #d4c8b8",
            borderRadius: 12,
            padding: "28px 20px",
            background: "#faf7f2",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>No jobs in staging yet</h2>
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.55, margin: 0, maxWidth: 480, marginInline: "auto" }}>
            When field <strong>Sync</strong> is enabled (Stage C), completed jobs will appear here.
            Field **Sync to office** (⋯ menu) and Export cloud uploads land in the same staging bucket and show here after refresh.
          </p>
        </section>
      )}

      {listReady && jobList.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 16, margin: 0 }}>Job folders ({jobList.length})</h2>
            <button
              type="button"
              onClick={() => reloadJobs().catch(() => {})}
              disabled={busy || listRefreshing}
              style={{
                padding: "6px 10px",
                border: "1px solid #d4c8b8",
                borderRadius: 8,
                background: "#fff",
                fontSize: 12,
                cursor: listRefreshing ? "wait" : "pointer",
                color: "#6b5d4f",
              }}
            >
              {listRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {listError && (
            <p style={{ color: "#a33", fontSize: 13, margin: "0 0 12px" }} role="alert">
              {listError}
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {jobList.map((job) => {
              const title = job.displayName || "Field export";
              return (
                <li
                  key={job.id}
                  style={{
                    padding: "12px 0",
                    borderTop: "1px solid #e5ddd2",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to="/office/jobs/$jobId"
                        params={{ jobId: job.id }}
                        style={{
                          display: "block",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#7a4b2a",
                          textDecoration: "none",
                          lineHeight: 1.35,
                        }}
                      >
                        {title}
                      </Link>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 11,
                          color: "#8a7a68",
                          wordBreak: "break-all",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {job.id}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: "#6b5d4f", flexShrink: 0, textAlign: "right" }}>
                      {job.fileCount} file{job.fileCount === 1 ? "" : "s"}
                      {job.syncIncomplete && job.manifestFileCount != null ? (
                        <span
                          style={{ display: "block", fontSize: 11, color: "#a33", fontWeight: 600 }}
                          title={`${job.storageObjectCount} of ${job.manifestFileCount} files in storage`}
                        >
                          {job.storageObjectCount}/{job.manifestFileCount} in storage
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#8a7a68",
                        flexShrink: 0,
                        minWidth: 72,
                        textAlign: "right",
                      }}
                    >
                      {formatSizeMb(job.totalBytes)}
                    </span>
                    <Link
                      to="/office/jobs/$jobId"
                      params={{ jobId: job.id }}
                      style={{
                        padding: "8px 14px",
                        border: "1px solid #7a4b2a",
                        borderRadius: 8,
                        background: "#fff",
                        color: "#7a4b2a",
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p style={{ fontSize: 12, color: "#8a7a68", marginTop: 24 }}>
        Export on the phone and <code>/get?job=</code> remain fully available until Tim retires them
        after NLF is verified.
      </p>
    </div>
  );
}
