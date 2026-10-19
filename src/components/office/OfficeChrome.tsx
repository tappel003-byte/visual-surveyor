import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { OfficeJobFolder } from "@/lib/office-jobs.functions";
import { clearJobsCache } from "@/lib/office-client-cache";
import { officeDeleteJob, officeSetJobFrom, officeSetJobName } from "@/lib/office-mutate.functions";

/** Shared class for office toolbar/row buttons — :active depress + busy/disabled. */
export const OFFICE_BTN_CLASS = "office-btn";

/** PGG tokens — match public/survey.html home (warm paper, not Windows gray / purple). */
export const PGG = {
  bg: "#f7f5f2",
  paper: "#ffffff",
  ink: "#1f1b16",
  muted: "#6b6357",
  line: "#dcd6cc",
  accent: "#8b5e34",
  accentSoft: "#efe5d6",
  bad: "#a33",
  select: "#e8d9c4",
  selectBorder: "#8b5e34",
  shadow: "0 1px 2px rgba(0,0,0,.04)",
} as const;

/** Inject once under OfficeChrome; covers toolbar + job list + JobFileExplorer. */
export const OFFICE_BTN_CSS = `
  .office-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    transition: background-color .08s ease, border-color .08s ease, transform .08s ease, box-shadow .08s ease, opacity .08s ease;
  }
  .office-btn:hover:not(:disabled):not(.is-busy):not(.is-disabled) {
    background: ${PGG.accentSoft} !important;
    border-color: ${PGG.accent} !important;
  }
  .office-btn:active:not(:disabled):not(.is-busy):not(.is-disabled),
  .office-btn.is-pressed:not(:disabled):not(.is-busy):not(.is-disabled) {
    background: #e2d4bf !important;
    border-color: ${PGG.accent} !important;
    transform: translateY(1px);
    box-shadow: inset 0 1px 2px rgba(0,0,0,.14);
  }
  .office-btn:disabled,
  .office-btn.is-busy,
  .office-btn.is-disabled {
    opacity: 0.45 !important;
    cursor: wait !important;
    pointer-events: none;
    transform: none !important;
    box-shadow: none !important;
  }
  .office-btn.office-btn-danger:active:not(:disabled):not(.is-busy),
  .office-btn.office-btn-danger.is-pressed:not(:disabled):not(.is-busy) {
    background: #f5d0d0 !important;
    border-color: #8a3030 !important;
  }
  .office-btn.office-btn-primary {
    background: ${PGG.accentSoft} !important;
    border-color: ${PGG.accent} !important;
    color: ${PGG.accent} !important;
  }
  .office-btn.office-btn-primary:active:not(:disabled):not(.is-busy),
  .office-btn.office-btn-primary.is-pressed:not(:disabled):not(.is-busy) {
    background: #e0d0b8 !important;
  }
  .office-btn.office-btn-linkish {
    box-shadow: none;
    border-color: transparent !important;
    background: transparent !important;
  }
  .office-btn.office-btn-linkish:active:not(:disabled):not(.is-busy),
  .office-btn.office-btn-linkish.is-pressed:not(:disabled):not(.is-busy) {
    background: ${PGG.accentSoft} !important;
    transform: none;
    box-shadow: none;
  }
  .office-thumb.office-btn:active:not(:disabled),
  .office-thumb.office-btn.is-pressed:not(:disabled) {
    outline: 2px solid ${PGG.accent};
    outline-offset: 1px;
    background: ${PGG.accentSoft} !important;
  }
  .office-status-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: ${PGG.accentSoft};
    border-bottom: 1px solid ${PGG.line};
    color: ${PGG.ink};
    font-size: 12px;
    font-weight: 600;
    min-height: 28px;
  }
  .office-status-spin {
    width: 12px;
    height: 12px;
    border: 2px solid ${PGG.line};
    border-top-color: ${PGG.accent};
    border-radius: 50%;
    animation: office-spin .7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes office-spin { to { transform: rotate(360deg); } }

  /* File-manager row chrome */
  .office-list-row {
    cursor: default;
    outline: none;
  }
  .office-list-row:hover td,
  .office-list-row:hover {
    background: ${PGG.accentSoft};
  }
  .office-list-row.is-selected td,
  .office-list-row.is-selected {
    background: ${PGG.select} !important;
  }
  .office-list-row:focus-visible td,
  .office-list-row:focus-visible {
    outline: 1px solid ${PGG.selectBorder};
    outline-offset: -1px;
  }
  .office-col-header {
    position: sticky;
    top: 0;
    z-index: 2;
    background: ${PGG.bg};
    border-bottom: 1px solid ${PGG.line};
    font-size: 12px;
    font-weight: 600;
    color: ${PGG.ink};
    padding: 6px 10px;
    white-space: nowrap;
    user-select: none;
    text-align: left;
  }
  .office-col-header button {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .office-col-header button:hover { color: ${PGG.accent}; }
  .office-col-header button:focus-visible {
    outline: 1px solid ${PGG.accent};
    outline-offset: 2px;
  }
  .office-nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 12px;
    margin: 0;
    border-left: 3px solid transparent;
    text-decoration: none;
    color: ${PGG.ink};
    font-size: 13px;
    line-height: 1.25;
    border-radius: 0;
  }
  .office-nav-item:hover {
    background: ${PGG.accentSoft};
  }
  .office-nav-item.is-active {
    background: ${PGG.select};
    border-left-color: ${PGG.selectBorder};
    font-weight: 600;
  }
  .office-cmd-sep {
    width: 1px;
    align-self: stretch;
    background: ${PGG.line};
    margin: 2px 4px;
    flex-shrink: 0;
  }
  .office-cmd-group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
`;

export function formatLastSynced(iso: string | null): string {
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

export function formatSize(totalBytes: number): string {
  if (!totalBytes) return "—";
  const mb = totalBytes / (1024 * 1024);
  if (mb < 0.01) return "<0.01 MB";
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** Always show a From label — Unknown when never set. */
export function fromLabel(syncedFrom: string | null | undefined): string {
  const t = syncedFrom?.trim();
  return t || "Unknown";
}

/** NLF www office staging working set (~1 GB). */
export const OFFICE_STAGING_BUDGET_BYTES = 1024 * 1024 * 1024;

const DOWNLOAD_MONTH_WARN_BYTES = 10 * 1024 * 1024 * 1024;

function formatStagingBytes(used: number, jobCount: number): string {
  if (used <= 0 && jobCount > 0) return "size unknown";
  if (used >= 1024 * 1024 * 1024) return `${(used / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (used >= 1024 * 1024) {
    return `${(used / (1024 * 1024)).toFixed(used >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (used > 0) return `${Math.max(1, Math.round(used / 1024))} KB`;
  return "0 MB";
}

/** Compact staging used vs 1 GB — status-strip style, not marketing card. */
export function OfficeStagingCapacity({
  usedBytes,
  jobCount,
  downloadedMonthBytes = 0,
}: {
  usedBytes: number;
  jobCount: number;
  /** Estimate of bytes downloaded via /office this calendar month. */
  downloadedMonthBytes?: number;
}) {
  const budget = OFFICE_STAGING_BUDGET_BYTES;
  const used = Math.max(0, usedBytes);
  const pct = Math.min(100, Math.round((used / budget) * 1000) / 10);
  const warn = pct >= 70;
  const critical = pct >= 90;
  const barColor = critical ? "#b45309" : warn ? "#c48a2a" : PGG.accent;
  const usedLabel = formatStagingBytes(used, jobCount);
  const dlBytes = Math.max(0, downloadedMonthBytes);
  const dlWarn = dlBytes >= DOWNLOAD_MONTH_WARN_BYTES * 0.8;
  const dlCritical = dlBytes >= DOWNLOAD_MONTH_WARN_BYTES;
  const dlLabel =
    dlBytes >= 1024 * 1024 * 1024
      ? `${(dlBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : dlBytes >= 1024 * 1024
        ? `${(dlBytes / (1024 * 1024)).toFixed(1)} MB`
        : dlBytes > 0
          ? `${Math.max(1, Math.round(dlBytes / 1024))} KB`
          : "0 MB";

  return (
    <div
      role="status"
      aria-label={`Office staging capacity: ${usedLabel} of 1 GB used. Downloaded this month (estimate): ${dlLabel}`}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 14px",
        padding: "6px 10px",
        marginBottom: 8,
        background: PGG.paper,
        border: `1px solid ${critical || warn || dlCritical ? "#e8c9a8" : PGG.line}`,
        fontSize: 12,
        color: PGG.muted,
      }}
    >
      <strong style={{ fontSize: 12, color: PGG.ink, fontWeight: 600 }}>Office staging</strong>
      <span style={{ color: PGG.muted }}>(temp)</span>
      <div
        style={{
          flex: "1 1 120px",
          maxWidth: 220,
          height: 6,
          borderRadius: 2,
          background: PGG.accentSoft,
          overflow: "hidden",
          border: `1px solid ${PGG.line}`,
        }}
      >
        <div
          style={{
            width: `${used <= 0 && jobCount > 0 ? 0 : Math.max(used > 0 ? 2 : 0, pct)}%`,
            height: "100%",
            background: barColor,
            transition: "width .2s ease",
          }}
        />
      </div>
      <span
        style={{ fontWeight: 600, color: critical ? "#8a4500" : PGG.ink, whiteSpace: "nowrap" }}
      >
        {usedLabel} / 1 GB
        {used > 0 ? ` (${pct}%)` : ""}
      </span>
      <span
        style={{
          fontWeight: 600,
          color: dlCritical ? "#8a4500" : dlWarn ? "#8a5a10" : PGG.ink,
          whiteSpace: "nowrap",
        }}
        title="Estimate from this site’s Download button. Netlify → Usage is the real number for billing credits."
      >
        Downloaded this month (estimate): {dlLabel}
        {dlWarn || dlCritical ? " — nearing 10 GB" : ""}
      </span>
      <span style={{ flex: "1 1 200px", minWidth: 0 }}>
        Phone Sync lands here — Download to this computer, then Delete to free the 1 GB. The
        download figure is an estimate; check Netlify → Usage for the real bandwidth number.
        {used <= 0 && jobCount > 0 ? " Re-sync to report size." : ""}
      </span>
    </div>
  );
}

/** One-line reminder — staging is temporary. */
export function OfficeDesktopReminder({ compact }: { compact?: boolean }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: compact ? "5px 10px" : "6px 10px",
        marginBottom: compact ? 8 : 8,
        background: PGG.accentSoft,
        border: `1px solid ${PGG.line}`,
        color: PGG.ink,
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <p style={{ margin: 0 }}>
        <strong style={{ fontWeight: 600 }}>Download to this computer</strong>
        {" — "}office staging is temporary phone Sync storage. Use Download / Download package, then
        Delete to free the 1 GB.
      </p>
    </div>
  );
}

type Props = {
  jobs: OfficeJobFolder[];
  listAvailable: boolean;
  selectedJobId: string | null;
  breadcrumbExtra?: string[];
  onRefresh: () => void;
  refreshing?: boolean;
  onJobsChanged: (jobs: OfficeJobFolder[]) => void;
  onLogout: () => void;
  /** Optional status from child (e.g. JobFileExplorer signing/download). */
  statusMessage?: string | null;
  /**
   * When on a job page, Download runs the token/sign package ZIP in place.
   * On the jobs list, omit this — Chrome navigates to the job and auto-starts.
   */
  onDownloadPackage?: () => void;
  /**
   * Primary ← Back (command bar). On a job page: up one folder or to the job list.
   * On the jobs list: omit — Chrome links Back to Field home.
   */
  onNavigateUp?: () => void;
  /** Tooltip / aria for onNavigateUp (e.g. "Back to parent folder"). */
  navigateUpLabel?: string;
  children: ReactNode;
};

export function OfficeChrome({
  jobs,
  listAvailable,
  selectedJobId,
  breadcrumbExtra = [],
  onRefresh,
  refreshing,
  onJobsChanged,
  onLogout,
  statusMessage = null,
  onDownloadPackage,
  onNavigateUp,
  navigateUpLabel,
  children,
}: Props) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "delete" | "from" | "name" | "open" | "logout" | "download" | "back" | null
  >(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = busyAction != null || !!refreshing;
  const selected = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null;
  const selectedTitle = selected?.displayName || selected?.id || "Jobs";
  const onJobsRoot = !selectedJobId;

  const backTitle =
    navigateUpLabel ||
    (selectedJobId
      ? breadcrumbExtra.length > 0
        ? "Back to parent folder"
        : "Back to office job list"
      : "Back to field home");

  const statusText =
    statusMessage ||
    localStatus ||
    (busyAction === "delete"
      ? "Deleting job…"
      : busyAction === "from"
        ? "Saving From…"
        : busyAction === "name"
          ? "Saving job name…"
          : busyAction === "open"
            ? "Opening…"
            : busyAction === "logout"
              ? "Signing out…"
              : busyAction === "download"
                ? "Starting download to this computer…"
                : busyAction === "back"
                  ? "Going back…"
                  : refreshing
                    ? "Refreshing…"
                    : null);

  useEffect(() => {
    if (!localStatus || busyAction === "download") return;
    const t = window.setTimeout(() => setLocalStatus(null), 2200);
    return () => window.clearTimeout(t);
  }, [localStatus, busyAction]);

  useEffect(() => {
    if (!refreshing && localStatus === "Refreshing…") {
      setLocalStatus("List updated.");
    }
  }, [refreshing, localStatus]);

  const onDelete = async () => {
    if (!selectedJobId || !selected || busy) return;
    const name = selected.displayName || selectedJobId;
    if (
      !confirm(
        `Delete "${name}" from office staging?\n\nThis removes the synced copy from shared storage. Field phones keep their local copy. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyAction("delete");
    setLocalStatus("Deleting job…");
    setError(null);
    try {
      await officeDeleteJob({
        data: { jobId: selectedJobId, source: selected?.source ?? null },
      });
      clearJobsCache();
      onJobsChanged(jobs.filter((j) => j.id !== selectedJobId));
      setSidebarOpen(false);
      setLocalStatus("Deleted.");
      await navigate({ to: "/office" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setLocalStatus(null);
    } finally {
      setBusyAction(null);
    }
  };

  const onEditFrom = async () => {
    if (!selectedJobId || !selected || busy) return;
    const current = selected.syncedFrom?.trim() || "";
    const next = window.prompt(
      "Set From (user and device). Same label phones set on Sync — saved into the job without a full re-sync.",
      current || "",
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) {
      setError("From cannot be empty.");
      return;
    }
    setBusyAction("from");
    setLocalStatus("Saving From…");
    setError(null);
    try {
      const result = await officeSetJobFrom({
        data: { jobId: selectedJobId, syncedFrom: label, source: selected?.source ?? null },
      });
      onJobsChanged(
        jobs.map((j) => (j.id === selectedJobId ? { ...j, syncedFrom: result.syncedFrom } : j)),
      );
      setLocalStatus("From saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update From.");
      setLocalStatus(null);
    } finally {
      setBusyAction(null);
    }
  };

  const onEditName = async () => {
    if (!selectedJobId || !selected || busy) return;
    const current = selected.displayName?.trim() || "";
    const next = window.prompt(
      "Customer / job name (address or site title). Shows in the job list and File Explorer header. Saved without a full re-sync.",
      current || "",
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) {
      setError("Job name cannot be empty.");
      return;
    }
    setBusyAction("name");
    setLocalStatus("Saving job name…");
    setError(null);
    try {
      const result = await officeSetJobName({
        data: {
          jobId: selectedJobId,
          folderName: label,
          source: selected?.source ?? null,
        },
      });
      onJobsChanged(
        jobs.map((j) => (j.id === selectedJobId ? { ...j, displayName: result.folderName } : j)),
      );
      setLocalStatus("Job name saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update job name.");
      setLocalStatus(null);
    } finally {
      setBusyAction(null);
    }
  };

  const markOpenBusy = () => {
    setBusyAction("open");
    setLocalStatus("Opening…");
    window.setTimeout(() => {
      setBusyAction((cur) => (cur === "open" ? null : cur));
      setLocalStatus((cur) => (cur === "Opening…" ? null : cur));
    }, 2500);
  };

  const onPackageDownload = () => {
    if (!selectedJobId || busy) return;
    setBusyAction("download");
    setError(null);
    if (onDownloadPackage) {
      setLocalStatus(null);
      try {
        onDownloadPackage();
      } finally {
        window.setTimeout(() => {
          setBusyAction((cur) => (cur === "download" ? null : cur));
        }, 800);
      }
      return;
    }
    setLocalStatus("Opening download…");
    // From the jobs list: open File Explorer and auto-start package ZIP (token/sign).
    try {
      sessionStorage.setItem("pgg_office_auto_package", selectedJobId); // OFFICE_AUTO_PACKAGE_KEY
    } catch {
      /* ignore */
    }
    void navigate({
      to: "/office/jobs/$jobId",
      params: { jobId: selectedJobId },
    }).finally(() => {
      setBusyAction((cur) => (cur === "download" ? null : cur));
      setLocalStatus(null);
    });
  };

  const onLogoutClick = () => {
    setBusyAction("logout");
    setLocalStatus("Signing out…");
    onLogout();
  };

  const onRefreshClick = () => {
    setLocalStatus("Refreshing…");
    onRefresh();
  };

  /** Primary Back: job page uses onNavigateUp; list page → Field home. */
  const onBackClick = () => {
    if (busy) return;
    if (selectedJobId && onNavigateUp) {
      setBusyAction("back");
      setLocalStatus("Going back…");
      try {
        onNavigateUp();
      } finally {
        window.setTimeout(() => {
          setBusyAction((cur) => (cur === "back" ? null : cur));
          setLocalStatus((cur) => (cur === "Going back…" ? null : cur));
        }, 280);
      }
      return;
    }
    if (selectedJobId) {
      setBusyAction("back");
      setLocalStatus("Going back…");
      void navigate({ to: "/office" }).finally(() => {
        setBusyAction((cur) => (cur === "back" ? null : cur));
        setLocalStatus(null);
      });
      return;
    }
    setBusyAction("back");
    setLocalStatus("Going back…");
    window.location.href = "/";
  };

  return (
    <div style={root}>
      {/* Title bar */}
      <header style={titleBar}>
        <button
          type="button"
          className={`office-nav-toggle ${OFFICE_BTN_CLASS}`}
          onClick={() => setSidebarOpen((v) => !v)}
          style={iconBtn}
          aria-label="Toggle navigation pane"
        >
          ☰
        </button>
        <FolderIcon small />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: PGG.ink, letterSpacing: "-0.01em" }}>
            File Explorer — PGG Office
          </div>
          <div
            style={{
              fontSize: 11,
              color: PGG.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            PGG Photo Documentation · staging
          </div>
        </div>
        <a
          href="/"
          className={`${OFFICE_BTN_CLASS} office-field-home`}
          style={quietBtn}
          title="Back to field home — Open all jobs & capture"
        >
          <span className="office-field-home-short">Home</span>
          <span className="office-field-home-long">Field home</span>
        </a>
        <button
          type="button"
          onClick={onLogoutClick}
          style={quietBtn}
          className={`${OFFICE_BTN_CLASS}${busyAction === "logout" ? " is-busy" : ""}`}
          disabled={busy}
        >
          {busyAction === "logout" ? "…" : "Sign out"}
        </button>
      </header>

      {/* Command bar — grouped like Explorer; ← Back first (primary nav) */}
      <div style={toolbar} role="toolbar" aria-label="File commands">
        <div className="office-cmd-group">
          {onJobsRoot ? (
            <a
              href="/"
              className={`${OFFICE_BTN_CLASS} office-btn-primary`}
              style={{ ...toolBtn, fontWeight: 700, gap: 4 }}
              title={backTitle}
              aria-label={backTitle}
              onClick={() => {
                setBusyAction("back");
                setLocalStatus("Going back…");
              }}
            >
              <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                ←
              </span>
              Back
            </a>
          ) : (
            <button
              type="button"
              onClick={onBackClick}
              disabled={busy}
              className={`${OFFICE_BTN_CLASS} office-btn-primary${busyAction === "back" ? " is-busy" : ""}`}
              style={{ ...toolBtn, fontWeight: 700, gap: 4 }}
              title={backTitle}
              aria-label={backTitle}
            >
              <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                ←
              </span>
              {busyAction === "back" ? "…" : "Back"}
            </button>
          )}
        </div>
        <span className="office-cmd-sep" aria-hidden />
        <div className="office-cmd-group">
          {selectedJobId ? (
            <Link
              to="/office/jobs/$jobId"
              params={{ jobId: selectedJobId }}
              style={toolBtn}
              className={`${OFFICE_BTN_CLASS}${busyAction === "open" ? " is-busy" : ""}`}
              onClick={markOpenBusy}
              aria-disabled={busyAction === "open"}
            >
              {busyAction === "open" ? "Opening…" : "Open"}
            </Link>
          ) : (
            <span style={toolBtn} className={`${OFFICE_BTN_CLASS} is-disabled`}>
              Open
            </span>
          )}
          {selectedJobId ? (
            <button
              type="button"
              style={toolBtn}
              className={`${OFFICE_BTN_CLASS}${busyAction === "download" ? " is-busy" : ""}`}
              onClick={onPackageDownload}
              disabled={busy}
            >
              {busyAction === "download" ? "Downloading…" : "Download"}
            </button>
          ) : (
            <span style={toolBtn} className={`${OFFICE_BTN_CLASS} is-disabled`}>
              Download
            </span>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={!selectedJobId || busy}
            className={`${OFFICE_BTN_CLASS} office-btn-danger${!selectedJobId ? " is-disabled" : ""}${busyAction === "delete" ? " is-busy" : ""}`}
            style={{ ...toolBtn, color: selectedJobId ? PGG.bad : undefined }}
          >
            {busyAction === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
        <span className="office-cmd-sep" aria-hidden />
        <div className="office-cmd-group">
          <button
            type="button"
            onClick={onEditName}
            disabled={!selectedJobId || busy}
            className={`${OFFICE_BTN_CLASS}${!selectedJobId ? " is-disabled" : ""}${busyAction === "name" ? " is-busy" : ""}`}
            style={toolBtn}
            title="Edit customer / job name (list + header)"
          >
            {busyAction === "name" ? "Saving…" : "Name…"}
          </button>
          <button
            type="button"
            onClick={onEditFrom}
            disabled={!selectedJobId || busy}
            className={`${OFFICE_BTN_CLASS}${!selectedJobId ? " is-disabled" : ""}${busyAction === "from" ? " is-busy" : ""}`}
            style={toolBtn}
            title="Edit From label on this job"
          >
            {busyAction === "from" ? "Saving…" : "From…"}
          </button>
        </div>
        <span className="office-cmd-sep" aria-hidden />
        <div className="office-cmd-group">
          <button
            type="button"
            onClick={onRefreshClick}
            disabled={busy}
            className={`${OFFICE_BTN_CLASS}${refreshing ? " is-busy" : ""}`}
            style={toolBtn}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Status / progress */}
      {statusText && (
        <div className="office-status-bar" role="status" aria-live="polite">
          {(busy || refreshing) && <span className="office-status-spin" aria-hidden />}
          <span>{statusText}</span>
        </div>
      )}

      {/* Address / breadcrumb bar */}
      <nav aria-label="Breadcrumb" style={breadcrumbBar}>
        <span style={{ color: PGG.muted, fontWeight: 600, marginRight: 4 }}>›</span>
        <a href="/" style={crumbLink} className={`${OFFICE_BTN_CLASS} office-btn-linkish`}>
          Field home
        </a>
        <span style={crumbSep}>›</span>
        <Link to="/office" style={crumbLink} className={`${OFFICE_BTN_CLASS} office-btn-linkish`}>
          Office
        </Link>
        {selected && (
          <>
            <span style={crumbSep}>›</span>
            <Link
              to="/office/jobs/$jobId"
              params={{ jobId: selected.id }}
              style={crumbLink}
              className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
            >
              {selectedTitle}
            </Link>
          </>
        )}
        {breadcrumbExtra.map((seg, i) => (
          <span
            key={`${seg}-${i}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span style={crumbSep}>›</span>
            <span style={{ fontWeight: i === breadcrumbExtra.length - 1 ? 700 : 500 }}>{seg}</span>
          </span>
        ))}
      </nav>

      {error && (
        <p
          style={{
            margin: 0,
            padding: "8px 12px",
            background: "#fdf4e0",
            color: "#5c4210",
            fontSize: 12,
            borderBottom: `1px solid ${PGG.line}`,
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      <div style={bodyRow} className="office-body">
        {sidebarOpen && (
          <button
            type="button"
            className="office-sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            style={scrim}
          />
        )}

        <aside className={`office-sidebar${sidebarOpen ? " open" : ""}`} style={sidebar}>
          <div style={sidebarHead}>Navigation</div>
          <div style={sidebarSection}>Quick access</div>
          <Link
            to="/office"
            onClick={() => setSidebarOpen(false)}
            className={`office-nav-item${onJobsRoot ? " is-active" : ""}`}
          >
            <FolderIcon small />
            <span>All jobs</span>
          </Link>

          <div style={sidebarSection}>Jobs ({jobs.length})</div>
          {!listAvailable && (
            <p style={{ padding: "8px 12px", fontSize: 12, color: PGG.bad, margin: 0 }}>
              List unavailable — try Refresh. If it keeps failing, check the latest Netlify deploy.
            </p>
          )}
          {listAvailable && jobs.length === 0 && (
            <p style={{ padding: "8px 12px", fontSize: 12, color: PGG.muted, margin: 0 }}>
              No jobs yet
            </p>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, overflow: "auto", flex: 1 }}>
            {jobs.map((job) => {
              const active = job.id === selectedJobId;
              const title = job.displayName || "Field export";
              return (
                <li key={job.id}>
                  <Link
                    to="/office/jobs/$jobId"
                    params={{ jobId: job.id }}
                    onClick={() => {
                      setSidebarOpen(false);
                      markOpenBusy();
                    }}
                    className={`office-nav-item${active ? " is-active" : ""}`}
                    title={`${title} · ${fromLabel(job.syncedFrom)}`}
                  >
                    <FolderIcon small />
                    <span style={{ minWidth: 0, overflow: "hidden" }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11,
                          color: PGG.muted,
                          fontWeight: 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fromLabel(job.syncedFrom)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <main style={mainPane}>{children}</main>
      </div>

      {/* Details / status strip */}
      <footer style={detailsBar}>
        <span>
          {jobs.length} item{jobs.length === 1 ? "" : "s"}
          {selected ? ` · Selected: ${selectedTitle}` : ""}
        </span>
        <span style={{ color: PGG.muted }}>PGG Office staging</span>
      </footer>

      <style>{`
        ${OFFICE_BTN_CSS}
        .office-nav-toggle { display: none; }
        .office-sidebar-scrim { display: none; }
        .office-field-home-short { display: none; }
        .office-field-home-long { display: inline; }
        @media (max-width: 800px) {
          .office-nav-toggle { display: inline-flex !important; }
          .office-sidebar {
            position: fixed !important;
            left: 0; top: 0; bottom: 0;
            z-index: 40;
            transform: translateX(-105%);
            transition: transform .18s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,.18);
            width: min(280px, 86vw) !important;
            background: ${PGG.paper} !important;
          }
          .office-sidebar.open { transform: translateX(0); }
          .office-sidebar-scrim { display: block !important; }
          .office-field-home-short { display: inline !important; }
          .office-field-home-long { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function FolderIcon({ small }: { small?: boolean }) {
  const s = small ? 16 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fill={PGG.accent}
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
      />
    </svg>
  );
}

const root: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  fontFamily: '"Segoe UI", "Segoe UI Variable", system-ui, sans-serif',
  color: PGG.ink,
  background: PGG.bg,
};

const titleBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  background: PGG.paper,
  borderBottom: `1px solid ${PGG.line}`,
};

const toolbar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 4,
  padding: "5px 8px",
  background: PGG.paper,
  borderBottom: `1px solid ${PGG.line}`,
};

const breadcrumbBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  background: PGG.paper,
  borderBottom: `1px solid ${PGG.line}`,
  fontSize: 12,
};

const bodyRow: CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
  position: "relative",
};

const sidebar: CSSProperties = {
  width: 220,
  flexShrink: 0,
  background: PGG.bg,
  borderRight: `1px solid ${PGG.line}`,
  display: "flex",
  flexDirection: "column",
};

const sidebarHead: CSSProperties = {
  padding: "8px 12px 4px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: PGG.muted,
};

const sidebarSection: CSSProperties = {
  padding: "10px 12px 4px",
  fontSize: 11,
  fontWeight: 600,
  color: PGG.muted,
};

const mainPane: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: PGG.paper,
  overflow: "auto",
};

const detailsBar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "4px 10px",
  fontSize: 11,
  color: PGG.ink,
  background: PGG.bg,
  borderTop: `1px solid ${PGG.line}`,
};

const toolBtn: CSSProperties = {
  padding: "4px 10px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 2,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
};

const quietBtn: CSSProperties = {
  ...toolBtn,
  boxShadow: "none",
  whiteSpace: "nowrap",
};

const iconBtn: CSSProperties = {
  ...toolBtn,
  padding: "4px 8px",
  fontSize: 15,
  lineHeight: 1,
};

const crumbLink: CSSProperties = {
  color: PGG.accent,
  textDecoration: "none",
  fontWeight: 600,
  padding: "1px 3px",
  borderRadius: 2,
};

const crumbSep: CSSProperties = { color: PGG.muted };

const scrim: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(31,27,22,.35)",
  border: 0,
  zIndex: 35,
  cursor: "pointer",
};
