import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { officeAuthStatus, officeLogin, officeLogout } from "@/lib/office-auth.functions";
import { officeGetJobDownload, type OfficeJobDownloadResult } from "@/lib/office-download.functions";
import { officeListJobs, type OfficeJobListResult } from "@/lib/office-jobs.functions";

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function JobDownloadPanel({
  jobId,
  busy,
  error,
  data,
}: {
  jobId: string;
  busy: boolean;
  error: string | null;
  data: OfficeJobDownloadResult | null;
}) {
  const getHref = data?.getPagePath ?? `/get?job=${encodeURIComponent(jobId)}`;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "14px 14px 12px",
        borderRadius: 10,
        background: "#faf7f2",
        border: "1px solid #e5ddd2",
      }}
    >
      {busy && !data && <p style={{ fontSize: 13, color: "#6b5d4f", margin: 0 }}>Loading download links…</p>}
      {error && (
        <p style={{ fontSize: 13, color: "#a33", margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {data && !data.storageLinksAvailable && (
        <p style={{ fontSize: 13, color: "#6b5d4f", lineHeight: 1.5, margin: "0 0 10px" }}>
          Per-file signed links need <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> on
          Netlify (same Lovable project). You can still use the legacy download page below — files come straight
          from storage in the browser, not through Netlify.
        </p>
      )}
      {data && data.storageLinksAvailable && data.kind === "empty" && (
        <p style={{ fontSize: 13, color: "#a33", margin: "0 0 10px" }}>
          No files found for this job in exports storage yet.
        </p>
      )}
      <p style={{ fontSize: 13, color: "#6b5d4f", lineHeight: 1.5, margin: "0 0 10px" }}>
        <a href={getHref} target="_blank" rel="noopener noreferrer" style={{ color: "#7a4b2a", fontWeight: 600 }}>
          Open download page
        </a>
        {" "}
        (<code>/get?job=…</code>) — ZIP-in-browser for smaller jobs; for very large folders prefer the per-file
        links below.
      </p>
      {data && data.files.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "#8a7a68", margin: "0 0 8px" }}>
            Direct links from Lovable storage (expire in ~{Math.round(data.signedUrlTtlSeconds / 60)} minutes).
            {data.folderName ? (
              <>
                {" "}
                Folder: <strong>{data.folderName}</strong>
              </>
            ) : null}
            {data.uploadKind === "office-sync" ? " · Synced from field" : null}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflowY: "auto" }}>
            {data.files.map((file) => (
              <li
                key={file.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: "1px solid #e5ddd2",
                }}
              >
                <span style={{ flex: 1, fontSize: 12, wordBreak: "break-all" }}>
                  {file.label}
                  {file.sizeBytes ? (
                    <span style={{ color: "#8a7a68" }}> {formatFileSize(file.sizeBytes)}</span>
                  ) : null}
                </span>
                <a
                  href={file.signedUrl}
                  download={file.label.split("/").pop() || file.label}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #7a4b2a",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#7a4b2a",
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
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
  const [downloadJobId, setDownloadJobId] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<OfficeJobDownloadResult | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

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
      setDownloadJobId(null);
      setDownloadData(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openDownload = async (jobId: string) => {
    if (downloadJobId === jobId && downloadData) {
      setDownloadJobId(null);
      setDownloadData(null);
      setDownloadError(null);
      return;
    }
    setDownloadJobId(jobId);
    setDownloadData(null);
    setDownloadError(null);
    setDownloadBusy(true);
    try {
      setDownloadData(await officeGetJobDownload({ data: { jobId } }));
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : "Could not load download links.");
    } finally {
      setDownloadBusy(false);
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
            Staging middleman — job folders synced from Lovable exports. Use <strong>Download</strong> on
            a row for direct storage links (large jobs) or the same <code>/get?job=</code> page as Export.
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
            Job list is unavailable. Set <code>EXPORTS_LIST_TOKEN</code> in Netlify environment variables
            (must match the token on the Lovable exports API), then redeploy. See{" "}
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
              const expanded = downloadJobId === job.id;
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
                        to="/get"
                        search={{ job: job.id }}
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
                    <span style={{ fontSize: 13, color: "#6b5d4f", flexShrink: 0 }}>
                      {job.fileCount} file{job.fileCount === 1 ? "" : "s"}
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
                      to="/get"
                      search={{ job: job.id }}
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
                    <button
                      type="button"
                      onClick={() => openDownload(job.id).catch(() => {})}
                      disabled={downloadBusy && downloadJobId === job.id}
                      style={{
                        padding: "8px 14px",
                        border: "1px solid #7a4b2a",
                        borderRadius: 8,
                        background: expanded ? "#faf7f2" : "#fff",
                        color: "#7a4b2a",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {expanded ? "Close" : "Download"}
                    </button>
                  </div>
                  {expanded && (
                    <JobDownloadPanel
                      jobId={job.id}
                      busy={downloadBusy}
                      error={downloadError}
                      data={downloadData}
                    />
                  )}
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
