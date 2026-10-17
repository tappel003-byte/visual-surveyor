import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { OfficeJobFolder } from "@/lib/office-jobs.functions";
import { officeDeleteJob, officeSetJobFrom } from "@/lib/office-mutate.functions";

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

type Props = {
  jobs: OfficeJobFolder[];
  listAvailable: boolean;
  selectedJobId: string | null;
  breadcrumbExtra?: string[];
  onRefresh: () => void;
  refreshing?: boolean;
  onJobsChanged: (jobs: OfficeJobFolder[]) => void;
  onLogout: () => void;
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
  children,
}: Props) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null;
  const selectedTitle = selected?.displayName || selected?.id || "This PC";

  const getHref = selectedJobId ? `/get?job=${encodeURIComponent(selectedJobId)}` : null;

  const onDelete = async () => {
    if (!selectedJobId || !selected) return;
    const name = selected.displayName || selectedJobId;
    if (
      !confirm(
        `Delete "${name}" from office staging?\n\nThis removes the synced copy from shared storage. Field phones keep their local copy. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await officeDeleteJob({ data: { jobId: selectedJobId } });
      onJobsChanged(jobs.filter((j) => j.id !== selectedJobId));
      setSidebarOpen(false);
      await navigate({ to: "/office" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const onEditFrom = async () => {
    if (!selectedJobId || !selected) return;
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
    setBusy(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update From.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={root}>
      {/* Title bar */}
      <header style={titleBar}>
        <button
          type="button"
          className="office-nav-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          style={iconBtn}
          aria-label="Toggle navigation pane"
        >
          ☰
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>PGG Office File Explorer</div>
          <div style={{ fontSize: 11, color: "#5f5f5f", overflow: "hidden", textOverflow: "ellipsis" }}>
            Staging · synced field jobs
          </div>
        </div>
        <button type="button" onClick={onLogout} style={toolBtn} disabled={busy}>
          Sign out
        </button>
      </header>

      {/* Toolbar */}
      <div style={toolbar}>
        <Link to="/office" style={toolBtn}>
          Home
        </Link>
        {selectedJobId ? (
          <Link to="/office/jobs/$jobId" params={{ jobId: selectedJobId }} style={toolBtn}>
            Open
          </Link>
        ) : (
          <span style={{ ...toolBtn, opacity: 0.45, pointerEvents: "none" }}>Open</span>
        )}
        {getHref ? (
          <a href={getHref} style={toolBtn}>
            Download
          </a>
        ) : (
          <span style={{ ...toolBtn, opacity: 0.45, pointerEvents: "none" }}>Download</span>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!selectedJobId || busy}
          style={{ ...toolBtn, color: selectedJobId ? "#a33" : undefined, opacity: selectedJobId ? 1 : 0.45 }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onEditFrom}
          disabled={!selectedJobId || busy}
          style={{ ...toolBtn, opacity: selectedJobId ? 1 : 0.45 }}
          title="Edit From label on this job"
        >
          From…
        </button>
        <button type="button" onClick={onRefresh} disabled={busy || refreshing} style={toolBtn}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={breadcrumbBar}>
        <Link to="/office" style={crumbLink}>
          Office
        </Link>
        {selected && (
          <>
            <span style={crumbSep}>›</span>
            <Link
              to="/office/jobs/$jobId"
              params={{ jobId: selected.id }}
              style={crumbLink}
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
        <p style={{ margin: 0, padding: "8px 12px", background: "#fff4f0", color: "#a33", fontSize: 13 }} role="alert">
          {error}
        </p>
      )}

      <div style={bodyRow} className="office-body">
        {/* Sidebar backdrop (phone) */}
        {sidebarOpen && (
          <button
            type="button"
            className="office-sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            style={scrim}
          />
        )}

        <aside
          className={`office-sidebar${sidebarOpen ? " open" : ""}`}
          style={sidebar}
        >
          <div style={sidebarHead}>Navigation</div>
          {!listAvailable && (
            <p style={{ padding: 12, fontSize: 12, color: "#a33", margin: 0 }}>
              List unavailable — check EXPORTS_LIST_TOKEN.
            </p>
          )}
          {listAvailable && jobs.length === 0 && (
            <p style={{ padding: 12, fontSize: 12, color: "#5f5f5f", margin: 0 }}>No jobs yet</p>
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
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      ...sidebarItem,
                      background: active ? "#cce8ff" : "transparent",
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
                      <span style={{ display: "block", fontSize: 11, color: "#5f5f5f" }}>
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

      <style>{`
        .office-nav-toggle { display: none; }
        .office-sidebar-scrim { display: none; }
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
          }
          .office-sidebar.open { transform: translateX(0); }
          .office-sidebar-scrim { display: block !important; }
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
        fill="#e8a317"
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
      />
    </svg>
  );
}

const root: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  fontFamily: "Segoe UI, system-ui, sans-serif",
  color: "#1a1a1a",
  background: "#f3f3f3",
};

const titleBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  background: "#fff",
  borderBottom: "1px solid #d4d4d4",
};

const toolbar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  padding: "6px 10px",
  background: "#f0f0f0",
  borderBottom: "1px solid #d4d4d4",
};

const breadcrumbBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: "#fff",
  borderBottom: "1px solid #d4d4d4",
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
  background: "#fff",
  borderRight: "1px solid #d4d4d4",
  display: "flex",
  flexDirection: "column",
};

const sidebarHead: CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#5f5f5f",
  borderBottom: "1px solid #ebebeb",
};

const sidebarItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  textDecoration: "none",
  color: "#1a1a1a",
  fontSize: 13,
};

const mainPane: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "#fff",
  overflow: "auto",
};

const toolBtn: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #8a8a8a",
  borderRadius: 3,
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
};

const iconBtn: CSSProperties = {
  ...toolBtn,
  padding: "4px 8px",
  fontSize: 16,
  lineHeight: 1,
};

const crumbLink: CSSProperties = {
  color: "#0b57d0",
  textDecoration: "none",
  fontWeight: 600,
};

const crumbSep: CSSProperties = { color: "#8a8a8a" };

const scrim: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  border: 0,
  zIndex: 35,
  cursor: "pointer",
};
