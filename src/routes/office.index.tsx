import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import {
  FolderIcon,
  OfficeChrome,
  formatLastSynced,
  formatSize,
  fromLabel,
} from "@/components/office/OfficeChrome";
import { officeAuthStatus, officeLogin, officeLogout } from "@/lib/office-auth.functions";
import { officeListJobs, type OfficeJobFolder, type OfficeJobListResult } from "@/lib/office-jobs.functions";
import { officeDeleteJob, officeSetJobFrom } from "@/lib/office-mutate.functions";

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

function OfficeExplorer() {
  const { auth: initialAuth, jobs: initialJobs } = Route.useLoaderData();
  const [auth, setAuth] = useState(initialAuth);
  const [jobs, setJobs] = useState<OfficeJobListResult | null>(initialJobs);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

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

  const shell: CSSProperties = {
    maxWidth: 480,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "Segoe UI, system-ui, sans-serif",
    color: "#1a1a1a",
  };

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

  const setJobList = (next: OfficeJobFolder[]) => {
    setJobs((prev) => ({ listAvailable: prev?.listAvailable ?? true, jobs: next }));
  };

  const editFrom = async (job: OfficeJobFolder) => {
    const next = window.prompt(
      "Set From (whose phone). Saved into the job manifest without a full re-sync.",
      job.syncedFrom?.trim() || "",
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) return;
    setRowBusyId(job.id);
    setListError(null);
    try {
      const result = await officeSetJobFrom({ data: { jobId: job.id, syncedFrom: label } });
      setJobList(jobList.map((j) => (j.id === job.id ? { ...j, syncedFrom: result.syncedFrom } : j)));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update From.");
    } finally {
      setRowBusyId(null);
    }
  };

  const deleteJob = async (job: OfficeJobFolder) => {
    const name = job.displayName || job.id;
    if (
      !confirm(
        `Delete "${name}" from office staging?\n\nRemoves the synced copy from shared storage. Field phones keep their local copy.`,
      )
    ) {
      return;
    }
    setRowBusyId(job.id);
    setListError(null);
    try {
      await officeDeleteJob({ data: { jobId: job.id } });
      setJobList(jobList.filter((j) => j.id !== job.id));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <OfficeChrome
      jobs={jobList}
      listAvailable={listReady}
      selectedJobId={null}
      onRefresh={() => reloadJobs().catch(() => {})}
      refreshing={listRefreshing}
      onJobsChanged={setJobList}
      onLogout={() => onLogout().catch(() => {})}
    >
      <div style={{ padding: "12px 14px 28px" }}>
        {!listReady && (
          <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5 }}>
            Job list unavailable — Netlify needs <code>EXPORTS_LIST_TOKEN</code>. Do not add{" "}
            <code>SUPABASE_*</code> on Netlify.
          </p>
        )}

        {listReady && jobList.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#5f5f5f" }}>
            <h2 style={{ fontSize: 17, margin: "0 0 8px", color: "#1a1a1a" }}>No jobs in staging yet</h2>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              On the phone: Sync to office (or Auto-sync). Then Refresh.
            </p>
          </div>
        )}

        {listError && (
          <p style={{ color: "#a33", fontSize: 13, margin: "0 0 12px" }} role="alert">
            {listError}
          </p>
        )}

        {listReady && jobList.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: "#5f5f5f", margin: "0 0 10px" }}>
              Date = last synced. From = device nickname (or set here for older jobs).
            </p>
            <div style={{ overflowX: "auto" }} className="office-job-table-wrap">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: "1px solid #d4d4d4",
                  minWidth: 680,
                }}
              >
                <thead>
                  <tr style={{ background: "#f3f3f3", textAlign: "left" }}>
                    <th style={th}>Name</th>
                    <th style={th} title="Last synced">
                      Date
                    </th>
                    <th style={th}>Type</th>
                    <th style={th}>Size</th>
                    <th style={th} title="Device nickname or office label">
                      From
                    </th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobList.map((job) => {
                    const title = job.displayName || "Field export";
                    const getHref = `/get?job=${encodeURIComponent(job.id)}`;
                    const rowBusy = rowBusyId === job.id;
                    return (
                      <tr key={job.id} style={{ borderTop: "1px solid #ebebeb" }}>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <FolderIcon />
                            <div style={{ minWidth: 0 }}>
                              <Link
                                to="/office/jobs/$jobId"
                                params={{ jobId: job.id }}
                                style={{ fontWeight: 600, color: "#0b57d0", textDecoration: "none" }}
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
                                >
                                  {job.storageObjectCount}/{job.manifestFileCount} in storage
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap", color: "#5f5f5f" }}>
                          {formatLastSynced(job.syncedAt)}
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
                        <td style={{ ...td, color: "#5f5f5f", maxWidth: 160 }}>
                          <button
                            type="button"
                            onClick={() => editFrom(job)}
                            disabled={rowBusy}
                            title="Edit From"
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              color: "#0b57d0",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: 13,
                            }}
                          >
                            {fromLabel(job.syncedFrom)}
                          </button>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <Link to="/office/jobs/$jobId" params={{ jobId: job.id }} style={actionBtn}>
                              Open
                            </Link>
                            <a href={getHref} style={actionBtn}>
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteJob(job)}
                              disabled={rowBusy}
                              style={{ ...actionBtn, color: "#a33", cursor: "pointer" }}
                            >
                              {rowBusy ? "…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="office-job-mobile" style={{ listStyle: "none", padding: 0, margin: 0, display: "none" }}>
              {jobList.map((job) => {
                const title = job.displayName || "Field export";
                const getHref = `/get?job=${encodeURIComponent(job.id)}`;
                const rowBusy = rowBusyId === job.id;
                return (
                  <li key={job.id} style={{ padding: "12px 0", borderBottom: "1px solid #ebebeb" }}>
                    <div style={{ display: "flex", gap: 10 }}>
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
                          }}
                        >
                          {title}
                        </Link>
                        <div style={{ fontSize: 12, color: "#5f5f5f", marginTop: 4, lineHeight: 1.4 }}>
                          {formatLastSynced(job.syncedAt)} · {formatSize(job.totalBytes)} ·{" "}
                          {job.fileCount} files ·{" "}
                          <button
                            type="button"
                            onClick={() => editFrom(job)}
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              color: "#0b57d0",
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {fromLabel(job.syncedFrom)}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
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
                          <button
                            type="button"
                            onClick={() => deleteJob(job)}
                            disabled={rowBusy}
                            style={{ ...actionBtn, color: "#a33", flex: 1 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <style>{`
              @media (max-width: 720px) {
                .office-job-table-wrap { display: none !important; }
                .office-job-mobile { display: block !important; }
              }
            `}</style>
          </>
        )}
      </div>
    </OfficeChrome>
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
  borderRadius: 3,
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
