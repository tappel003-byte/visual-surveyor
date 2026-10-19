import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
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
import {
  officeListJobs,
  type OfficeJobFolder,
  type OfficeJobListResult,
} from "@/lib/office-jobs.functions";
import { officeDeleteJob, officeSetJobFrom, officeSetJobName } from "@/lib/office-mutate.functions";
import { clearJobsCache, patchJobsCache, writeJobsCache } from "@/lib/office-client-cache";

type SortKey = "name" | "date" | "type" | "size" | "from";
type SortDir = "asc" | "desc";

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
        jobs = { listAvailable: false, jobs: [], locker: null };
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
  const [rowBusyKind, setRowBusyKind] = useState<
    "delete" | "from" | "name" | "open" | "download" | null
  >(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const navigate = useNavigate();

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
      const raw = err instanceof Error ? err.message : "";
      if (/wrong password/i.test(raw)) {
        setError(
          "That password didn’t work. Try again, or ask the office for the company password.",
        );
      } else if (/not configured|NLF_OFFICE|SESSION_SECRET/i.test(raw)) {
        setError(
          "Office sign-in isn’t set up on this site yet. Tell whoever runs Netlify to set the office password secrets, then try again.",
        );
      } else {
        setError("Couldn’t sign in. Check your connection and try again.");
      }
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

  const jobList = jobs?.jobs ?? [];
  const listReady = jobs?.listAvailable ?? false;

  const sortedJobs = useMemo(() => {
    const list = [...jobList];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.displayName || a.id).localeCompare(b.displayName || b.id, undefined, {
            sensitivity: "base",
          });
          break;
        case "date":
          cmp = (Date.parse(a.syncedAt || "") || 0) - (Date.parse(b.syncedAt || "") || 0);
          break;
        case "type":
          cmp = (a.fileCount || 0) - (b.fileCount || 0);
          break;
        case "size":
          cmp = (a.totalBytes || 0) - (b.totalBytes || 0);
          break;
        case "from":
          cmp = fromLabel(a.syncedFrom).localeCompare(fromLabel(b.syncedFrom), undefined, {
            sensitivity: "base",
          });
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [jobList, sortKey, sortDir]);

  // Seed session cache so Open job can reuse the latest list without an extra round-trip
  useEffect(() => {
    if (jobs?.listAvailable) writeJobsCache(jobs);
  }, [jobs]);

  if (!auth.configured) {
    const onLovable = auth.hostKind === "lovable";
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
          {onLovable ? (
            <>
              Office sign-in isn’t set on this temporary host yet. Ask whoever runs the project to set{" "}
              <code>OFFICE_PASSWORD</code> in Lovable secrets to the same company password used on{" "}
              <a href="https://www.pggphotodocumentation.com/office">www</a>, then Publish once.
            </>
          ) : (
            <>
              Office credentials are not set on this Netlify site yet. Add{" "}
              <code>NLF_OFFICE_PASSWORD</code> and <code>NLF_SESSION_SECRET</code>, then redeploy. See{" "}
              <code>docs/nlf-office-env.md</code>.
            </>
          )}
        </p>
        <a
          href="/"
          className={OFFICE_BTN_CLASS}
          style={{ ...actionBtn, marginTop: 16, display: "inline-flex" }}
        >
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
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              color: PGG.muted,
            }}
          >
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

  const setJobList = (next: OfficeJobFolder[]) => {
    setJobs((prev) => {
      const listAvailable = prev?.listAvailable ?? true;
      patchJobsCache(next, listAvailable);
      return { listAvailable, jobs: next, locker: prev?.locker ?? null };
    });
    if (selectedJobId && !next.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "size" ? "desc" : "asc");
    }
  };

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const openJob = (jobId: string) => {
    setSelectedJobId(jobId);
    markOpening(jobId);
    void navigate({ to: "/office/jobs/$jobId", params: { jobId } });
  };

  const editFrom = async (job: OfficeJobFolder) => {
    setSelectedJobId(job.id);
    const next = window.prompt(
      "Set From (user and device). Same label phones set on Sync — saved without a full re-sync.",
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
      const result = await officeSetJobFrom({
        data: { jobId: job.id, syncedFrom: label, source: job.source },
      });
      setJobList(
        jobList.map((j) => (j.id === job.id ? { ...j, syncedFrom: result.syncedFrom } : j)),
      );
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

  const editName = async (job: OfficeJobFolder) => {
    setSelectedJobId(job.id);
    const next = window.prompt(
      "Customer / job name (address or site title). Shows in the job list and File Explorer header.",
      job.displayName?.trim() || "",
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) return;
    setRowBusyId(job.id);
    setRowBusyKind("name");
    setStatusMessage(`Saving name for ${job.displayName || job.id}…`);
    setListError(null);
    try {
      const result = await officeSetJobName({
        data: { jobId: job.id, folderName: label, source: job.source },
      });
      setJobList(
        jobList.map((j) => (j.id === job.id ? { ...j, displayName: result.folderName } : j)),
      );
      setStatusMessage("Job name saved.");
      window.setTimeout(() => setStatusMessage(null), 1800);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update job name.");
      setStatusMessage(null);
    } finally {
      setRowBusyId(null);
      setRowBusyKind(null);
    }
  };

  const deleteJob = async (job: OfficeJobFolder) => {
    setSelectedJobId(job.id);
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
      await officeDeleteJob({ data: { jobId: job.id, source: job.source } });
      // Drop cache, then re-fetch so the list matches staging.
      clearJobsCache();
      setStatusMessage("Deleted — refreshing list…");
      try {
        const next = await officeListJobs();
        writeJobsCache(next);
        setJobs(next);
        const stillThere = next.jobs.some((j) => j.id === job.id);
        setStatusMessage(
          stillThere
            ? "Delete ran, but the job is still listed — tap Refresh. If it stays, tell the team."
            : "Deleted.",
        );
        window.setTimeout(() => setStatusMessage(null), stillThere ? 5000 : 1800);
      } catch {
        setJobList(jobList.filter((j) => j.id !== job.id));
        setStatusMessage("Deleted.");
        window.setTimeout(() => setStatusMessage(null), 1800);
      }
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

  const startPackageDownload = (jobId: string) => {
    setSelectedJobId(jobId);
    setRowBusyId(jobId);
    setRowBusyKind("download");
    setStatusMessage("Opening download…");
    try {
      sessionStorage.setItem("pgg_office_auto_package", jobId); // OFFICE_AUTO_PACKAGE_KEY
    } catch {
      /* ignore */
    }
    void navigate({
      to: "/office/jobs/$jobId",
      params: { jobId },
    }).finally(() => {
      setRowBusyId((cur) => (cur === jobId ? null : cur));
      setRowBusyKind((cur) => (cur === "download" ? null : cur));
      setStatusMessage(null);
    });
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (sortedJobs.length === 0) return;
    const idx = selectedJobId ? sortedJobs.findIndex((j) => j.id === selectedJobId) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = sortedJobs[Math.min(sortedJobs.length - 1, Math.max(0, idx + 1))];
      if (next) setSelectedJobId(next.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = sortedJobs[Math.max(0, idx <= 0 ? 0 : idx - 1)];
      if (next) setSelectedJobId(next.id);
    } else if (e.key === "Enter" && selectedJobId) {
      e.preventDefault();
      openJob(selectedJobId);
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedJobId(sortedJobs[0]?.id ?? null);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelectedJobId(sortedJobs[sortedJobs.length - 1]?.id ?? null);
    }
  };

  return (
    <OfficeChrome
      jobs={jobList}
      listAvailable={listReady}
      selectedJobId={selectedJobId}
      onRefresh={() => reloadJobs().catch(() => {})}
      refreshing={listRefreshing}
      onJobsChanged={setJobList}
      onLogout={() => onLogout().catch(() => {})}
      statusMessage={statusMessage}
    >
      <div style={{ padding: "8px 10px 20px" }}>
        <OfficeDesktopReminder />
        {listReady && (
          <OfficeStagingCapacity
            usedBytes={
              jobs?.locker?.usedBytes ??
              jobList.reduce((sum, j) => sum + (Number(j.totalBytes) || 0), 0)
            }
            jobCount={jobList.length}
            downloadedMonthBytes={jobs?.locker?.downloadedMonthBytes ?? 0}
          />
        )}

        {!listReady && (
          <p style={{ fontSize: 13, color: PGG.muted, lineHeight: 1.5 }}>
            Job list unavailable — try Refresh. On www, check the latest Netlify deploy and the
            office password secrets. Older jobs stay on the temporary lovable.app host through 16
            Dec 2026 — not on www.
          </p>
        )}

        {listReady && jobList.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              color: PGG.muted,
              border: `1px dashed ${PGG.line}`,
            }}
          >
            <h2 style={{ fontSize: 15, margin: "0 0 6px", color: PGG.ink, fontWeight: 600 }}>
              No jobs in staging yet
            </h2>
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.45 }}>
              www only shows new Syncs to this site. On the phone at www: Sync to office, then
              Refresh. Older synced jobs stay on lovable.app through 16 Dec 2026.
            </p>
          </div>
        )}

        {listError && (
          <p style={{ color: PGG.bad, fontSize: 12, margin: "0 0 8px" }} role="alert">
            {listError}
          </p>
        )}

        {listReady && jobList.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: PGG.muted, margin: "0 0 6px" }}>
              Click to select · double-click or Enter to open · Date = last synced · From = user
              &amp; device (phone nickname after Sync)
            </p>
            <div style={{ overflowX: "auto" }} className="office-job-table-wrap">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: `1px solid ${PGG.line}`,
                  background: PGG.paper,
                  minWidth: 680,
                }}
                aria-label="Synced jobs"
              >
                <thead>
                  <tr>
                    {(
                      [
                        ["name", "Name"],
                        ["date", "Date"],
                        ["type", "Type"],
                        ["size", "Size"],
                        ["from", "From"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="office-col-header" title={`Sort by ${label}`}>
                        <button type="button" onClick={() => toggleSort(key)}>
                          {label}
                          {sortMark(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  tabIndex={0}
                  onKeyDown={onListKeyDown}
                  style={{ outline: "none" }}
                  aria-label="Job list — use arrow keys to select"
                >
                  {sortedJobs.map((job) => {
                    const title = job.displayName || "Field export";
                    const selected = selectedJobId === job.id;
                    return (
                      <tr
                        key={job.id}
                        className={`office-list-row${selected ? " is-selected" : ""}`}
                        aria-selected={selected}
                        onClick={() => setSelectedJobId(job.id)}
                        onDoubleClick={() => openJob(job.id)}
                        style={{ borderTop: `1px solid ${PGG.line}` }}
                      >
                        <td style={td}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <FolderIcon />
                            <div style={{ minWidth: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void editName(job);
                                }}
                                disabled={rowBusyId === job.id}
                                title="Edit customer / job name"
                                className={`${OFFICE_BTN_CLASS} office-btn-linkish${rowBusyId === job.id && rowBusyKind === "name" ? " is-busy" : ""}`}
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  padding: "1px 2px",
                                  color: PGG.ink,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  fontSize: 13,
                                }}
                              >
                                {rowBusyId === job.id && rowBusyKind === "name" ? "Saving…" : title}
                              </button>
                              {job.syncIncomplete && job.manifestFileCount != null ? (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: PGG.bad,
                                    fontWeight: 600,
                                    marginTop: 1,
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
                        <td style={{ ...td, color: PGG.muted, whiteSpace: "nowrap" }}>
                          File folder
                          <span style={{ color: PGG.muted }}> · {job.fileCount} items</span>
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap", color: PGG.muted }}>
                          {formatSize(job.totalBytes)}
                        </td>
                        <td style={{ ...td, color: PGG.muted, maxWidth: 160 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void editFrom(job);
                            }}
                            disabled={rowBusyId === job.id}
                            title="Edit From"
                            className={`${OFFICE_BTN_CLASS} office-btn-linkish${rowBusyId === job.id && rowBusyKind === "from" ? " is-busy" : ""}`}
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: "1px 2px",
                              color: PGG.accent,
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: 13,
                            }}
                          >
                            {rowBusyId === job.id && rowBusyKind === "from"
                              ? "Saving…"
                              : fromLabel(job.syncedFrom)}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul
              className="office-job-mobile"
              style={{ listStyle: "none", padding: 0, margin: 0, display: "none" }}
            >
              {sortedJobs.map((job) => {
                const title = job.displayName || "Field export";
                const rowBusy = rowBusyId === job.id;
                const opening = openingJobId === job.id;
                const selected = selectedJobId === job.id;
                return (
                  <li
                    key={job.id}
                    className={`office-list-row${selected ? " is-selected" : ""}`}
                    onClick={() => setSelectedJobId(job.id)}
                    style={{
                      padding: "10px 8px",
                      borderBottom: `1px solid ${PGG.line}`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <FolderIcon />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void editName(job);
                          }}
                          disabled={rowBusy}
                          title="Edit customer / job name — Open with the Open button"
                          style={{
                            all: "unset",
                            display: "block",
                            fontSize: 14,
                            fontWeight: 600,
                            color: PGG.ink,
                            cursor: "pointer",
                            wordBreak: "break-word",
                          }}
                        >
                          {rowBusy && rowBusyKind === "name" ? "Saving…" : title}
                        </button>
                        <div
                          style={{ fontSize: 12, color: PGG.muted, marginTop: 3, lineHeight: 1.35 }}
                        >
                          {formatLastSynced(job.syncedAt)} · {formatSize(job.totalBytes)} ·{" "}
                          {job.fileCount} files ·{" "}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void editFrom(job);
                            }}
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
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <Link
                            to="/office/jobs/$jobId"
                            params={{ jobId: job.id }}
                            onClick={() => markOpening(job.id)}
                            className={`${OFFICE_BTN_CLASS}${opening ? " is-busy" : ""}`}
                            style={{ ...actionBtn, flex: 1, justifyContent: "center" }}
                          >
                            {opening ? "Opening…" : "Open"}
                          </Link>
                          <button
                            type="button"
                            className={`${OFFICE_BTN_CLASS}${rowBusy && rowBusyKind === "download" ? " is-busy" : ""}`}
                            style={{ ...actionBtn, flex: 1, justifyContent: "center" }}
                            disabled={rowBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              startPackageDownload(job.id);
                            }}
                          >
                            {rowBusy && rowBusyKind === "download" ? "…" : "Download"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteJob(job);
                            }}
                            disabled={rowBusy}
                            className={`${OFFICE_BTN_CLASS} office-btn-danger${rowBusy && rowBusyKind === "delete" ? " is-busy" : ""}`}
                            style={{
                              ...actionBtn,
                              color: PGG.bad,
                              flex: 1,
                              justifyContent: "center",
                            }}
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

const td: CSSProperties = {
  padding: "5px 10px",
  verticalAlign: "middle",
};

const actionBtn: CSSProperties = {
  padding: "6px 10px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 2,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
