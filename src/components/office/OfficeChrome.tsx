import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { OfficeJobFolder } from "@/lib/office-jobs.functions";
import { officeDeleteJob, officeSetJobFrom } from "@/lib/office-mutate.functions";

/** Shared class for office toolbar/row buttons — :active depress + busy/disabled. */
export const OFFICE_BTN_CLASS = "office-btn";

/** PGG tokens — match public/survey.html home. */
export const PGG = {
  bg: "#f7f5f2",
  paper: "#ffffff",
  ink: "#1f1b16",
  muted: "#6b6357",
  line: "#dcd6cc",
  accent: "#8b5e34",
  accentSoft: "#efe5d6",
  bad: "#a33",
  shadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.05)",
} as const;

/** Inject once under OfficeChrome; covers toolbar + job list + JobFileExplorer. */
export const OFFICE_BTN_CSS = `
  .office-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    transition: background-color .08s ease, border-color .08s ease, transform .08s ease, box-shadow .08s ease, opacity .08s ease;
    box-shadow: 0 1px 0 rgba(0,0,0,.04);
  }
  .office-btn:hover:not(:disabled):not(.is-busy):not(.is-disabled) {
    background: ${PGG.accentSoft} !important;
    border-color: ${PGG.accent} !important;
  }
  .office-btn:active:not(:disabled):not(.is-busy):not(.is-disabled),
  .office-btn.is-pressed:not(:disabled):not(.is-busy):not(.is-disabled) {
    background: #e2d4bf !important;
    border-color: ${PGG.accent} !important;
    transform: translateY(1px) scale(0.97);
    box-shadow: inset 0 1px 3px rgba(0,0,0,.16);
  }
  .office-btn:disabled,
  .office-btn.is-busy,
  .office-btn.is-disabled {
    opacity: 0.55 !important;
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
    padding: 8px 14px;
    background: ${PGG.accentSoft};
    border-bottom: 1px solid ${PGG.line};
    color: ${PGG.ink};
    font-size: 13px;
    font-weight: 600;
    min-height: 36px;
  }
  .office-status-spin {
    width: 14px;
    height: 14px;
    border: 2px solid ${PGG.line};
    border-top-color: ${PGG.accent};
    border-radius: 50%;
    animation: office-spin .7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes office-spin { to { transform: rotate(360deg); } }
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

/** Staging used vs 1 GB budget — sum of job totalBytes (from manifests). */
export function OfficeStagingCapacity({
  usedBytes,
  jobCount,
}: {
  usedBytes: number;
  jobCount: number;
}) {
  const budget = OFFICE_STAGING_BUDGET_BYTES;
  const used = Math.max(0, usedBytes);
  const pct = Math.min(100, Math.round((used / budget) * 1000) / 10);
  const warn = pct >= 70;
  const critical = pct >= 90;
  const barColor = critical ? "#b45309" : warn ? "#c48a2a" : PGG.accent;
  const usedLabel =
    used <= 0 && jobCount > 0
      ? "size unknown"
      : used >= 1024 * 1024 * 1024
        ? `${(used / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : used >= 1024 * 1024
          ? `${(used / (1024 * 1024)).toFixed(used >= 100 * 1024 * 1024 ? 0 : 1)} MB`
          : used > 0
            ? `${Math.max(1, Math.round(used / 1024))} KB`
            : "0 MB";

  return (
    <div
      role="status"
      aria-label={`Staging capacity: ${usedLabel} of 1 GB used`}
      style={{
        padding: "12px 14px",
        marginBottom: 14,
        background: PGG.paper,
        border: `1px solid ${critical || warn ? "#e8c9a8" : PGG.line}`,
        borderRadius: 12,
        boxShadow: PGG.shadow,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 14, color: PGG.ink, fontWeight: 700 }}>
          Staging capacity
        </strong>
        <span style={{ fontSize: 13, fontWeight: 700, color: critical ? "#8a4500" : PGG.ink }}>
          Used: {usedLabel} of 1 GB
          {used > 0 ? ` (${pct}%)` : ""}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
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
            borderRadius: 999,
            transition: "width .2s ease",
          }}
        />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: PGG.muted, lineHeight: 1.4 }}>
        www office staging working set (~1 GB). Download jobs to this computer, then Delete to free
        space.
        {used <= 0 && jobCount > 0
          ? " Re-sync a job from the phone to report its size."
          : ""}
      </p>
    </div>
  );
}

/** One calm reminder: staging is temporary — get files onto the desktop. */
export function OfficeDesktopReminder({ compact }: { compact?: boolean }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: compact ? "10px 12px" : "12px 14px",
        marginBottom: compact ? 12 : 14,
        background: PGG.accentSoft,
        border: `1px solid ${PGG.line}`,
        borderRadius: 12,
        boxShadow: PGG.shadow,
        color: PGG.ink,
        fontSize: compact ? 13 : 14,
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>
        💾
      </span>
      <p style={{ margin: 0 }}>
        <strong style={{ fontWeight: 700 }}>Download jobs to this computer.</strong>{" "}
        Office staging is a temporary holding area — use{" "}
        <strong style={{ fontWeight: 700 }}>Download</strong> /{" "}
        <strong style={{ fontWeight: 700 }}>Download package</strong> so the files live on your
        desktop (or Documents), not only online.
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
  children,
}: Props) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"delete" | "from" | "open" | "logout" | "download" | null>(
    null,
  );
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = busyAction != null || !!refreshing;
  const selected = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null;
  const selectedTitle = selected?.displayName || selected?.id || "Jobs";

  const getHref = selectedJobId ? `/get?job=${encodeURIComponent(selectedJobId)}` : null;

  const statusText =
    statusMessage ||
    localStatus ||
    (busyAction === "delete"
      ? "Deleting job…"
      : busyAction === "from"
        ? "Saving From…"
        : busyAction === "open"
          ? "Opening…"
          : busyAction === "logout"
            ? "Signing out…"
            : busyAction === "download"
              ? "Starting download…"
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
      await officeDeleteJob({ data: { jobId: selectedJobId } });
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
      "Set From (whose phone / who synced). Saved into the job manifest so the column stays filled without a full re-sync.",
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
        data: { jobId: selectedJobId, syncedFrom: label },
      });
      onJobsChanged(
        jobs.map((j) =>
          j.id === selectedJobId ? { ...j, syncedFrom: result.syncedFrom } : j,
        ),
      );
      setLocalStatus("From saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update From.");
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
    if (!getHref) return;
    setBusyAction("download");
    setLocalStatus("Starting download…");
    window.setTimeout(() => {
      setBusyAction((cur) => (cur === "download" ? null : cur));
      setLocalStatus("Download started — check your browser downloads.");
    }, 1600);
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: PGG.muted,
              fontWeight: 600,
            }}
          >
            PGG Photo Documentation
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: PGG.ink, letterSpacing: "-0.02em" }}>
            Office staging
          </div>
        </div>
        <a
          href="/"
          className={`${OFFICE_BTN_CLASS} office-btn-primary office-field-home`}
          style={fieldHomeBtn}
          title="Back to field home — Open all jobs & capture"
        >
          <span className="office-field-home-short">Home</span>
          <span className="office-field-home-long">Field home</span>
        </a>
        <button
          type="button"
          onClick={onLogoutClick}
          style={toolBtn}
          className={`${OFFICE_BTN_CLASS}${busyAction === "logout" ? " is-busy" : ""}`}
          disabled={busy}
        >
          {busyAction === "logout" ? "…" : "Sign out"}
        </button>
      </header>

      {/* Toolbar */}
      <div style={toolbar}>
        <Link to="/office" style={toolBtn} className={OFFICE_BTN_CLASS}>
          Jobs
        </Link>
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
        {getHref ? (
          <a
            href={getHref}
            style={toolBtn}
            className={`${OFFICE_BTN_CLASS}${busyAction === "download" ? " is-busy" : ""}`}
            onClick={onPackageDownload}
          >
            {busyAction === "download" ? "Downloading…" : "Download"}
          </a>
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

      {/* Status / progress */}
      {statusText && (
        <div className="office-status-bar" role="status" aria-live="polite">
          {(busy || refreshing) && <span className="office-status-spin" aria-hidden />}
          <span>{statusText}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={breadcrumbBar}>
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
          <span key={`${seg}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={crumbSep}>›</span>
            <span style={{ fontWeight: i === breadcrumbExtra.length - 1 ? 700 : 500 }}>{seg}</span>
          </span>
        ))}
      </nav>

      {error && (
        <p
          style={{
            margin: 0,
            padding: "10px 14px",
            background: "#fdf4e0",
            color: "#5c4210",
            fontSize: 13,
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
          <div style={sidebarHead}>Jobs</div>
          {!listAvailable && (
            <p style={{ padding: 12, fontSize: 12, color: PGG.bad, margin: 0 }}>
              List unavailable — check EXPORTS_LIST_TOKEN.
            </p>
          )}
          {listAvailable && jobs.length === 0 && (
            <p style={{ padding: 12, fontSize: 12, color: PGG.muted, margin: 0 }}>No jobs yet</p>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: "4px 0", overflow: "auto", flex: 1 }}>
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
                    className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
                    style={{
                      ...sidebarItem,
                      background: active ? PGG.accentSoft : "transparent",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <FolderIcon small />
                    <span style={{ minWidth: 0 }}>
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
                      <span style={{ display: "block", fontSize: 11, color: PGG.muted }}>
                        {fromLabel(job.syncedFrom)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div style={{ padding: 12, borderTop: `1px solid ${PGG.line}` }}>
            <a
              href="/"
              className={`${OFFICE_BTN_CLASS} office-btn-primary`}
              style={{ ...toolBtn, width: "100%", justifyContent: "center" }}
            >
              ← Field home
            </a>
          </div>
        </aside>

        <main style={mainPane}>{children}</main>
      </div>

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
  const s = small ? 16 : 20;
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
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: PGG.ink,
  background: PGG.bg,
};

const titleBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  background: PGG.paper,
  borderBottom: `1px solid ${PGG.line}`,
  boxShadow: PGG.shadow,
};

const toolbar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: "8px 12px",
  background: PGG.bg,
  borderBottom: `1px solid ${PGG.line}`,
};

const breadcrumbBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: PGG.paper,
  borderBottom: `1px solid ${PGG.line}`,
  fontSize: 13,
};

const bodyRow: CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
  position: "relative",
};

const sidebar: CSSProperties = {
  width: 240,
  flexShrink: 0,
  background: PGG.paper,
  borderRight: `1px solid ${PGG.line}`,
  display: "flex",
  flexDirection: "column",
};

const sidebarHead: CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: PGG.muted,
  borderBottom: `1px solid ${PGG.line}`,
};

const sidebarItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  textDecoration: "none",
  color: PGG.ink,
  fontSize: 13,
  borderRadius: 10,
  margin: "2px 6px",
};

const mainPane: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: PGG.bg,
  overflow: "auto",
};

const toolBtn: CSSProperties = {
  padding: "8px 12px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 10,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  boxShadow: PGG.shadow,
};

const fieldHomeBtn: CSSProperties = {
  ...toolBtn,
  padding: "8px 14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const iconBtn: CSSProperties = {
  ...toolBtn,
  padding: "6px 10px",
  fontSize: 16,
  lineHeight: 1,
};

const crumbLink: CSSProperties = {
  color: PGG.accent,
  textDecoration: "none",
  fontWeight: 600,
  padding: "2px 4px",
  borderRadius: 6,
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
