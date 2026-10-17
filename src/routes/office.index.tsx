import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
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

function formatSize(totalBytes: number): string {
  if (!totalBytes) return "—";
  const mb = totalBytes / (1024 * 1024);
  if (mb < 0.01) return "<0.01 MB";
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** Date column = Last synced (`syncedAt`). */
function formatLastSynced(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    maxWidth: 1100,
    margin: "0 auto",
    padding: "20px 16px 40px",
    fontFamily: "Segoe UI, system-ui, sans-serif",
    color: "#1a1a1a",
  } as const;

  if (!auth.configured) {
    return (
      <div style={shell}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>PGG Office File Explorer</h1>
        <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5 }}>
          Office credentials are not set on this Netlify site yet. Add{" "}
          <code>NLF_OFFICE_PASSWORD</code> and <code>NLF_SESSION_SECRET</code>, then redeploy. See{" "}
          <code>docs/nlf-office-env.md</code>.
        </p>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div style={shell}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>PGG Office File Explorer</h1>
        <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5, marginBottom: 20 }}>
          Company password required. Browse synced field jobs and download files — not the field
          survey app.
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
              borderRadius: 4,
              border: "1px solid #c8c8c8",
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
              padding: "10px 18px",
              border: 0,
              borderRadius: 4,
              background: "#0b57d0",
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
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4, fontWeight: 600 }}>PGG Office File Explorer</h1>
          <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5, margin: 0 }}>
            Synced field jobs. <strong>Open</strong> browses files; <strong>Download</strong> starts
            the package link (<code>/get?job=</code>). Date is last synced.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {listReady && (
            <button
              type="button"
              onClick={() => reloadJobs().catch(() => {})}
              disabled={busy || listRefreshing}
              style={{
                padding: "8px 12px",
                border: "1px solid #8a8a8a",
                borderRadius: 4,
                background: "#fff",
                fontSize: 13,
                cursor: listRefreshing ? "wait" : "pointer",
                color: "#1a1a1a",
                fontWeight: 600,
              }}
            >
              {listRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            style={{
              padding: "8px 12px",
              border: "1px solid #8a8a8a",
              borderRadius: 4,
              background: "#fff",
              color: "#1a1a1a",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {!listReady && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 8,
            padding: "16px 14px",
            background: "#fff8f0",
            marginBottom: 18,
          }}
        >
          <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5, margin: 0 }}>
            Job list unavailable — Netlify needs <code>EXPORTS_LIST_TOKEN</code> (same Bearer as
            Lovable). Do not add <code>SUPABASE_*</code> on Netlify. See{" "}
            <code>docs/nlf-office-env.md</code>.
          </p>
        </section>
      )}

      {listReady && jobList.length === 0 && (
        <section
          style={{
            border: "1px dashed #c8c8c8",
            borderRadius: 8,
            padding: "28px 20px",
            background: "#f7f7f7",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>No jobs in staging yet</h2>
          <p
            style={{
              fontSize: 14,
              color: "#5f5f5f",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 480,
              marginInline: "auto",
            }}
          >
            On the phone: open a job → ⋯ → <strong>Sync to office</strong>. Then tap Refresh here.
          </p>
        </section>
      )}

      {listError && (
        <p style={{ color: "#a33", fontSize: 13, margin: "0 0 12px" }} role="alert">
          {listError}
        </p>
      )}

      {listReady && jobList.length > 0 && (
        <section>
          <h2 style={{ fontSize: 15, margin: "0 0 10px", fontWeight: 600, color: "#5f5f5f" }}>
            {jobList.length} job{jobList.length === 1 ? "" : "s"}
          </h2>

          {/* Desktop / wide: details table */}
          <div className="office-job-table-wrap" style={{ overflowX: "auto" }}>
            <table
              className="office-job-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                background: "#fff",
                border: "1px solid #d4d4d4",
                minWidth: 640,
              }}
            >
              <thead>
                <tr style={{ background: "#f3f3f3", textAlign: "left" }}>
                  <th style={th}>Name</th>
                  <th style={th} title="Last synced from the field phone">
                    Date
                  </th>
                  <th style={th}>Type</th>
                  <th style={th}>Size</th>
                  <th style={th} title="Device nickname set on the phone">
                    From
                  </th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobList.map((job) => {
                  const title = job.displayName || "Field export";
                  const getHref = `/get?job=${encodeURIComponent(job.id)}`;
                  return (
                    <tr key={job.id} style={{ borderTop: "1px solid #ebebeb" }}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <FolderIcon />
                          <div style={{ minWidth: 0 }}>
                            <Link
                              to="/office/jobs/$jobId"
                              params={{ jobId: job.id }}
                              style={{
                                fontWeight: 600,
                                color: "#0b57d0",
                                textDecoration: "none",
                                wordBreak: "break-word",
                              }}
                            >
                              {title}
                            </Link>
                            {job.syncIncomplete && job.manifestFileCount != null ? (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 11,
                                  color: "#a33",
                                  fontWeight: 600,
                                  marginTop: 2,
                                }}
                                title={`${job.storageObjectCount} of ${job.manifestFileCount} files in storage`}
                              >
                                {job.storageObjectCount}/{job.manifestFileCount} in storage
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap", color: "#5f5f5f" }}>
                        <span title="Last synced">{formatLastSynced(job.syncedAt)}</span>
                      </td>
                      <td style={{ ...td, color: "#5f5f5f" }}>
                        Folder
                        <span style={{ display: "block", fontSize: 11, color: "#8a8a8a" }}>
                          {job.fileCount} file{job.fileCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap", color: "#5f5f5f" }}>
                        {formatSize(job.totalBytes)}
                      </td>
                      <td style={{ ...td, color: "#5f5f5f", maxWidth: 140 }}>
                        {job.syncedFrom || "—"}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <Link
                            to="/office/jobs/$jobId"
                            params={{ jobId: job.id }}
                            style={actionBtn}
                          >
                            Open
                          </Link>
                          <a href={getHref} style={actionBtn}>
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone: compact stacked rows (shown via CSS) */}
          <ul className="office-job-mobile" style={{ listStyle: "none", padding: 0, margin: 0, display: "none" }}>
            {jobList.map((job) => {
              const title = job.displayName || "Field export";
              const getHref = `/get?job=${encodeURIComponent(job.id)}`;
              return (
                <li
                  key={job.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #ebebeb",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <FolderIcon />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to="/office/jobs/$jobId"
                        params={{ jobId: job.id }}
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#0b57d0",
                          textDecoration: "none",
                          wordBreak: "break-word",
                          lineHeight: 1.35,
                        }}
                      >
                        {title}
                      </Link>
                      <div style={{ fontSize: 12, color: "#5f5f5f", marginTop: 4, lineHeight: 1.4 }}>
                        {formatLastSynced(job.syncedAt)}
                        {" · "}
                        {formatSize(job.totalBytes)}
                        {" · "}
                        {job.fileCount} file{job.fileCount === 1 ? "" : "s"}
                        {job.syncedFrom ? ` · ${job.syncedFrom}` : ""}
                      </div>
                      {job.syncIncomplete && job.manifestFileCount != null ? (
                        <div style={{ fontSize: 11, color: "#a33", fontWeight: 600, marginTop: 2 }}>
                          {job.storageObjectCount}/{job.manifestFileCount} in storage
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <Link
                          to="/office/jobs/$jobId"
                          params={{ jobId: job.id }}
                          style={{ ...actionBtn, flex: 1, textAlign: "center" }}
                        >
                          Open
                        </Link>
                        <a href={getHref} style={{ ...actionBtn, flex: 1, textAlign: "center" }}>
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <style>{`
        @media (max-width: 720px) {
          .office-job-table-wrap { display: none !important; }
          .office-job-mobile { display: block !important; }
        }
      `}</style>
    </div>
  );
}

const th: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #d4d4d4",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "10px",
  verticalAlign: "middle",
};

const actionBtn: CSSProperties = {
  padding: "7px 12px",
  border: "1px solid #8a8a8a",
  borderRadius: 4,
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
      <path
        fill="#e8a317"
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
      />
    </svg>
  );
}
