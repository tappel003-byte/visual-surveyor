import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import {
  FolderIcon,
  OFFICE_BTN_CLASS,
  OfficeChrome,
  OfficeDesktopReminder,
  OfficeStagingCapacity,
  PGG,
  formatLastSynced,
  formatSize,
  fromLabel,
} from "@/components/office/OfficeChrome";
import { officeAuthStatus, officeLogin, officeLogout } from "@/lib/office-auth.functions";
import { officeListJobs, type OfficeJobFolder, type OfficeJobListResult } from "@/lib/office-jobs.functions";
import { officeDeleteJob, officeSetJobFrom } from "@/lib/office-mutate.functions";
import {
  clearJobsCache,
  patchJobsCache,
  writeJobsCache,
} from "@/lib/office-client-cache";

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
  pendingComponent: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: PGG.muted,
        background: PGG.bg,
        padding: 24,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          border: `2px solid ${PGG.line}`,
          borderTopColor: PGG.accent,
          borderRadius: "50%",
          animation: "office-spin .7s linear infinite",
        }}
      />
      <span style={{ fontWeight: 700, color: PGG.ink, fontSize: 15 }}>Loading jobs…</span>
      <span style={{ fontSize: 13, textAlign: "center", maxWidth: 280 }}>
        Fetching the office list. Large staging folders can take a few seconds.
      </span>
      <style>{`@keyframes office-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
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
  const [rowBusyKind, setRowBusyKind] = useState<"delete" | "from" | "open" | "download" | null>(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reloadJobs = async () => {
    setListError(null);
    setListRefreshing(true);
    setStatusMessage("Refreshing job list…");
    try {
      const next = await officeListJobs();
      writeJobsCache(next);
      setJobs(next);
      setStatusMessage("List updated.");
      window.setTimeout(() => setStatusMessage(null), 1600);
    } catch {
      setListError("Could not refresh the job list. Try again in a moment.");
      setStatusMessage(null);
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
      clearJobsCache();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const shell: CSSProperties = {
    maxWidth: 480,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: PGG.ink,
    minHeight: "100vh",
    background: PGG.bg,
  };

  if (!auth.configured) {
    return (
      <div style={shell}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PGG.muted,
            fontWeight: 600,
            margin: "0 0 6px",
          }}
        >
          PGG Photo Documentation
        </p>
        <h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>Office staging</h1>
        <p style={{ fontSize: 14, color: PGG.muted, lineHeight: 1.5 }}>
          Office credentials are not set on this Netlify site yet. Add{" "}
          <code>NLF_OFFICE_PASSWORD</code> and <code>NLF_SESSION_SECRET</code>, then redeploy. See{" "}
          <code>docs/nlf-office-env.md</code>.
        </p>
        <a href="/" className={OFFICE_BTN_CLASS} style={{ ...actionBtn, marginTop: 16, display: "inline-flex" }}>
          ← Field home
        </a>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div style={shell}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PGG.muted,
            fontWeight: 600,
            margin: "0 0 6px",
          }}
        >
          PGG Photo Documentation
        </p>
        <h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>Office staging</h1>
        <p style={{ fontSize: 14, color: PGG.muted, lineHeight: 1.5, marginBottom: 20 }}>
          Company password required. Browse synced field jobs and download files — not the field
          survey app.
        </p>
        <form
          onSubmit={onLogin}
          style={{
            background: PGG.paper,
            border: `1px solid ${PGG.line}`,
            borderRadius: 14,
            padding: 18,
            boxShadow: PGG.shadow,
          }}
        >
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: PGG.muted }}>
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
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${PGG.line}`,
              fontSize: 16,
              background: PGG.paper,
              color: PGG.ink,
            }}
          />
          {error && (
            <p style={{ color: PGG.bad, fontSize: 13, marginTop: 10 }} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className={`${OFFICE_BTN_CLASS}${busy ? " is-busy" : ""}`}
            style={{
              marginTop: 14,
              padding: "12px 18px",
              border: 0,
              borderRadius: 10,
              background: PGG.ink,
              color: PGG.paper,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: 20 }}>
          <a href="/" style={{ color: PGG.accent, fontWeight: 600, fontSize: 14 }}>
            ← Back to field home
          </a>
        </p>
        <style>{`
          .office-btn {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }
          .office-btn:active:not(:disabled) {
            transform: translateY(1px) scale(0.97);
            opacity: 0.9;
          }
          .office-btn.is-busy, .office-btn:disabled {
            opacity: 0.55;
            cursor: wait;
          }
        `}</style>
      </div>
    );
  }

  const jobList = jobs?.jobs ?? [];
  const listReady = jobs?.listAvailable ?? false;

  const setJobList = (next: OfficeJobFolder[]) => {
    setJobs((prev) => {
      const listAvailable = prev?.listAvailable ?? true;
      patchJobsCache(next, listAvailable);
      return { listAvailable, jobs: next };
    });
  };

  // Seed session cache so Open job can skip a full Lovable list round-trip
  useEffect(() => {
    if (jobs?.listAvailable) writeJobsCache(jobs);
  }, [jobs]);

  const editFrom = async (job: OfficeJobFolder) => {
    const next = window.prompt(
      "Set From (whose phone). Saved into the job manifest without a full re-sync.",
      job.syncedFrom?.trim() || "",
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) return;
    setRowBusyId(job.id);
    setRowBusyKind("from");
    setStatusMessage(`Saving From for ${job.displayName || job.id}…`);
    setListError(null);
    try {
      const result = await officeSetJobFrom({ data: { jobId: job.id, syncedFrom: label } });
      setJobList(jobList.map((j) => (j.id === job.id ? { ...j, syncedFrom: result.syncedFrom } : j)));
      setStatusMessage("From saved.");
      window.setTimeout(() => setStatusMessage(null), 1800);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update From.");
      setStatusMessage(null);
    } finally {
      setRowBusyId(null);
      setRowBusyKind(null);
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
    setRowBusyKind("delete");
    setStatusMessage(`Deleting ${name}…`);
    setListError(null);
    try {
      await officeDeleteJob({ data: { jobId: job.id } });
      setJobList(jobList.filter((j) => j.id !== job.id));
      setStatusMessage("Deleted.");
      window.setTimeout(() => setStatusMessage(null), 1800);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Delete failed.");
      setStatusMessage(null);
    } finally {
      setRowBusyId(null);
      setRowBusyKind(null);
    }
  };

  const markOpening = (jobId: string) => {
    setOpeningJobId(jobId);
    setRowBusyKind("open");
    setStatusMessage("Opening…");
    window.setTimeout(() => {
      setOpeningJobId((cur) => (cur === jobId ? null : cur));
      setRowBusyKind((cur) => (cur === "open" ? null : cur));
      setStatusMessage((cur) => (cur === "Opening…" ? null : cur));
    }, 2500);
  };

  const markDownload = (jobId: string) => {
    setRowBusyId(jobId);
    setRowBusyKind("download");
    setStatusMessage("Starting download…");
    window.setTimeout(() => {
      setRowBusyId((cur) => (cur === jobId ? null : cur));
      setRowBusyKind((cur) => (cur === "download" ? null : cur));
      setStatusMessage("Download started — check browser downloads.");
      window.setTimeout(() => setStatusMessage(null), 2200);
    }, 1400);
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
      statusMessage={statusMessage}
    >
      <div style={{ padding: "14px 14px 28px" }}>
        <OfficeDesktopReminder />
        {listReady && (
          <OfficeStagingCapacity
            usedBytes={jobList.reduce((sum, j) => sum + (Number(j.totalBytes) || 0), 0)}
            jobCount={jobList.length}
          />
        )}

        {!listReady && (
          <p style={{ fontSize: 14, color: PGG.muted, lineHeight: 1.5 }}>
            Job list unavailable — Netlify needs <code>EXPORTS_LIST_TOKEN</code>. Do not add{" "}
            <code>SUPABASE_*</code> on Netlify.
          </p>
        )}

        {listReady && jobList.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 16px",
              color: PGG.muted,
              background: PGG.paper,
              border: `1px dashed ${PGG.line}`,
              borderRadius: 14,
            }}
          >
            <h2 style={{ fontSize: 17, margin: "0 0 8px", color: PGG.ink }}>No jobs in staging yet</h2>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              On the phone: Sync to office (or Auto-sync). Then Refresh.
            </p>
          </div>
        )}

        {listError && (
          <p style={{ color: PGG.bad, fontSize: 13, margin: "0 0 12px" }} role="alert">
            {listError}
          </p>
        )}

        {listReady && jobList.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: PGG.muted, margin: "0 0 12px" }}>
              Date = last synced. From = device nickname (or set here for older jobs).
            </p>
            <div style={{ overflowX: "auto" }} className="office-job-table-wrap">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: `1px solid ${PGG.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: PGG.paper,
                  boxShadow: PGG.shadow,
                  minWidth: 680,
                }}
              >
                <thead>
                  <tr style={{ background: PGG.accentSoft, textAlign: "left" }}>
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
                    const opening = openingJobId === job.id;
                    return (
                      <tr key={job.id} style={{ borderTop: `1px solid ${PGG.line}` }}>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <FolderIcon />
                            <div style={{ minWidth: 0 }}>
                              <Link
                                to="/office/jobs/$jobId"
                                params={{ jobId: job.id }}
                                onClick={() => markOpening(job.id)}
                                style={{ fontWeight: 600, color: PGG.accent, textDecoration: "none" }}
                              >
                                {title}
                              </Link>
                              {job.syncIncomplete && job.manifestFileCount != null ? (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: PGG.bad,
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
                        <td style={{ ...td, whiteSpace: "nowrap", color: PGG.muted }}>
                          {formatLastSynced(job.syncedAt)}
                        </td>
                        <td style={{ ...td, color: PGG.muted }}>
                          Folder
                          <span style={{ display: "block", fontSize: 11, color: PGG.muted }}>
                            {job.fileCount} file{job.fileCount === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap", color: PGG.muted }}>
                          {formatSize(job.totalBytes)}
                        </td>
                        <td style={{ ...td, color: PGG.muted, maxWidth: 160 }}>
                          <button
                            type="button"
                            onClick={() => editFrom(job)}
                            disabled={rowBusy}
                            title="Edit From"
                            className={`${OFFICE_BTN_CLASS} office-btn-linkish${rowBusy && rowBusyKind === "from" ? " is-busy" : ""}`}
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: "2px 4px",
                              color: PGG.accent,
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: 13,
                              borderRadius: 6,
                            }}
                          >
                            {rowBusy && rowBusyKind === "from" ? "Saving…" : fromLabel(job.syncedFrom)}
                          </button>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <Link
                              to="/office/jobs/$jobId"
                              params={{ jobId: job.id }}
                              onClick={() => markOpening(job.id)}
                              className={`${OFFICE_BTN_CLASS}${opening ? " is-busy" : ""}`}
                              style={actionBtn}
                            >
                              {opening ? "Opening…" : "Open"}
                            </Link>
                            <a
                              href={getHref}
                              className={`${OFFICE_BTN_CLASS}${rowBusy && rowBusyKind === "download" ? " is-busy" : ""}`}
                              style={actionBtn}
                              onClick={() => markDownload(job.id)}
                            >
                              {rowBusy && rowBusyKind === "download" ? "Downloading…" : "Download"}
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteJob(job)}
                              disabled={rowBusy}
                              className={`${OFFICE_BTN_CLASS} office-btn-danger${rowBusy && rowBusyKind === "delete" ? " is-busy" : ""}`}
                              style={{ ...actionBtn, color: PGG.bad, cursor: "pointer" }}
                            >
                              {rowBusy && rowBusyKind === "delete" ? "Deleting…" : "Delete"}
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
                const opening = openingJobId === job.id;
                return (
                  <li
                    key={job.id}
                    style={{
                      padding: 14,
                      marginBottom: 10,
                      background: PGG.paper,
                      border: `1px solid ${PGG.line}`,
                      borderRadius: 14,
                      boxShadow: PGG.shadow,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10 }}>
                      <FolderIcon />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          to="/office/jobs/$jobId"
                          params={{ jobId: job.id }}
                          onClick={() => markOpening(job.id)}
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: PGG.accent,
                            textDecoration: "none",
                            wordBreak: "break-word",
                          }}
                        >
                          {title}
                        </Link>
                        <div style={{ fontSize: 12, color: PGG.muted, marginTop: 4, lineHeight: 1.4 }}>
                          {formatLastSynced(job.syncedAt)} · {formatSize(job.totalBytes)} ·{" "}
                          {job.fileCount} files ·{" "}
                          <button
                            type="button"
                            onClick={() => editFrom(job)}
                            disabled={rowBusy}
                            className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              color: PGG.accent,
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {fromLabel(job.syncedFrom)}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          <Link
                            to="/office/jobs/$jobId"
                            params={{ jobId: job.id }}
                            onClick={() => markOpening(job.id)}
                            className={`${OFFICE_BTN_CLASS}${opening ? " is-busy" : ""}`}
                            style={{ ...actionBtn, flex: 1, textAlign: "center", justifyContent: "center" }}
                          >
                            {opening ? "Opening…" : "Open"}
                          </Link>
                          <a
                            href={getHref}
                            className={`${OFFICE_BTN_CLASS}${rowBusy && rowBusyKind === "download" ? " is-busy" : ""}`}
                            style={{ ...actionBtn, flex: 1, textAlign: "center", justifyContent: "center" }}
                            onClick={() => markDownload(job.id)}
                          >
                            {rowBusy && rowBusyKind === "download" ? "…" : "Download"}
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteJob(job)}
                            disabled={rowBusy}
                            className={`${OFFICE_BTN_CLASS} office-btn-danger${rowBusy && rowBusyKind === "delete" ? " is-busy" : ""}`}
                            style={{ ...actionBtn, color: PGG.bad, flex: 1, justifyContent: "center" }}
                          >
                            {rowBusy && rowBusyKind === "delete" ? "Deleting…" : "Delete"}
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
  padding: "10px 12px",
  borderBottom: `1px solid ${PGG.line}`,
  fontWeight: 600,
  whiteSpace: "nowrap",
  color: PGG.muted,
  fontSize: 12,
};

const td: CSSProperties = {
  padding: "12px",
  verticalAlign: "middle",
};

const actionBtn: CSSProperties = {
  padding: "8px 12px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 10,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  boxShadow: PGG.shadow,
};
