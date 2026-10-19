import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { OfficeJobDownloadResult } from "@/lib/office-download.functions";
import {
  fileTypeLabel,
  isImageFileName,
  isPdfFileName,
  listDirectory,
  toExplorerEntries,
  type ExplorerEntry,
} from "@/lib/office-file-tree";
import {
  downloadOfficeJobPackage,
  fetchOfficeFileBlob,
  OfficeSaveCancelledError,
  plainOfficeDownloadFailure,
  resolveOfficeOpenUrl,
  type OfficePackageProgress,
} from "@/lib/office-package-download";
import { saveBlobWithSaveAs } from "@/lib/office-save-file";
import {
  fromLabel,
  OFFICE_BTN_CLASS,
  OfficeDesktopReminder,
  PGG,
} from "@/components/office/OfficeChrome";
import { OfficePinNotesEditor } from "@/components/office/OfficePinNotesEditor";
import { loadSignedUrlMapForJob, writeSignedUrl } from "@/lib/office-client-cache";
import { officeSetJobName } from "@/lib/office-mutate.functions";

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const shell = {
  padding: "8px 10px 20px",
  fontFamily: '"Segoe UI", "Segoe UI Variable", system-ui, sans-serif',
  color: PGG.ink,
} as const;

const btnSecondary = {
  padding: "4px 10px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 2,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap" as const,
};

type Props = {
  jobId: string;
  title: string;
  data: OfficeJobDownloadResult;
  /** When true, Office chrome provides nav — keep header compact. */
  embedded?: boolean;
  onStatusChange?: (message: string | null) => void;
  /** After Name… save — parent updates list + header. */
  onDisplayNameChange?: (folderName: string) => void;
  /** When true (list Download → navigate here), start package download once. */
  autoPackageDownload?: boolean;
  /** Lets OfficeChrome toolbar Download run the same package ZIP while already on this job. */
  registerPackageDownload?: (fn: (() => void) | null) => void;
  /** Lets OfficeChrome ← Back go up one folder or return to the job list. */
  registerNavigateUp?: (fn: (() => void) | null) => void;
  /** Folder segments under the job (chrome breadcrumb + Back tooltip). */
  onFolderPathChange?: (segments: string[]) => void;
};

export function JobFileExplorer({
  jobId,
  title,
  data,
  embedded,
  onStatusChange,
  onDisplayNameChange,
  autoPackageDownload = false,
  registerPackageDownload,
  registerNavigateUp,
  onFolderPathChange,
}: Props) {
  const navigate = useNavigate();
  const [dirPath, setDirPath] = useState("");
  const [preview, setPreview] = useState<{
    entry: ExplorerEntry;
    url: string;
    kind: "image" | "pdf";
  } | null>(null);
  const [urlCache, setUrlCache] = useState<Record<string, string>>(() =>
    loadSignedUrlMapForJob(jobId),
  );
  const urlCacheRef = useRef(urlCache);
  urlCacheRef.current = urlCache;
  const [signingPath, setSigningPath] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageProgress, setPackageProgress] = useState<OfficePackageProgress | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const inFlightRef = useRef<Record<string, Promise<string | null>>>({});
  const packageAbortRef = useRef<AbortController | null>(null);
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  const setStatus = (msg: string | null) => {
    statusRef.current?.(msg);
  };

  const onCancelPackage = () => {
    packageAbortRef.current?.abort();
    setStatus("Cancelling download…");
    setPackageProgress((prev) =>
      prev
        ? {
            ...prev,
            message: "Cancelling download to this computer…",
          }
        : prev,
    );
  };

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const displayTitle = localTitle || title || data.folderName || "Field export";

  const onEditName = async () => {
    if (nameBusy) return;
    const next = window.prompt(
      "Customer / job name (address or site title). Shows in the list and this header.",
      displayTitle === "Field export" ? "" : displayTitle,
    );
    if (next == null) return;
    const label = next.trim();
    if (!label) {
      setSignError("Job name cannot be empty.");
      return;
    }
    setNameBusy(true);
    setSignError(null);
    setStatus("Saving job name…");
    try {
      const result = await officeSetJobName({
        data: { jobId, folderName: label, source: data.source ?? null },
      });
      setLocalTitle(result.folderName);
      onDisplayNameChange?.(result.folderName);
      setStatus("Job name saved.");
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update job name.";
      setSignError(msg);
      setStatus(null);
    } finally {
      setNameBusy(false);
    }
  };

  const entries = useMemo(() => toExplorerEntries(data.files), [data.files]);
  const { folders, files } = useMemo(() => listDirectory(entries, dirPath), [entries, dirPath]);

  const imageFiles = useMemo(() => files.filter((f) => isImageFileName(f.name)), [files]);
  const otherFiles = useMemo(() => files.filter((f) => !isImageFileName(f.name)), [files]);

  const breadcrumbs = dirPath ? dirPath.split("/") : [];

  /** Parent/up: one level out of a folder, or back to the office job list at job root. */
  const goBackUp = () => {
    if (dirPath) {
      const parts = dirPath.split("/");
      parts.pop();
      setDirPath(parts.join("/"));
      setSelectedPath(null);
      return;
    }
    void navigate({ to: "/office" });
  };

  useEffect(() => {
    onFolderPathChange?.(dirPath ? dirPath.split("/") : []);
  }, [dirPath, onFolderPathChange]);

  useEffect(() => {
    registerNavigateUp?.(() => {
      goBackUp();
    });
    return () => registerNavigateUp?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep chrome Back wired to latest folder
  }, [dirPath, registerNavigateUp]);

  const resolveUrl = async (
    entry: ExplorerEntry,
    reason: "open" | "download" | "thumb" = "open",
  ): Promise<string | null> => {
    const cached = urlCacheRef.current[entry.storagePath];
    if (cached) return cached;

    const existing = inFlightRef.current[entry.storagePath];
    if (existing) return existing;

    const promise = (async () => {
      setSigningPath(entry.storagePath);
      setSignError(null);
      if (reason !== "thumb") {
        setStatus(
          reason === "download" ? `Preparing download: ${entry.name}…` : `Opening ${entry.name}…`,
        );
      }
      try {
        const fileMeta = data.files.find((f) => f.path === entry.storagePath);
        // Lovable: HTTPS signed URL. Blobs: blob: after chunk fetch.
        const { url } = await resolveOfficeOpenUrl(jobId, entry.storagePath, {
          totalChunks: fileMeta?.totalChunks,
          source: data.source ?? null,
        });
        writeSignedUrl(jobId, entry.storagePath, url, 60 * 60);
        setUrlCache((prev) => {
          const next = { ...prev, [entry.storagePath]: url };
          urlCacheRef.current = next;
          return next;
        });
        return url;
      } catch (err) {
        setSignError(plainOfficeDownloadFailure(err));
        setStatus(null);
        return null;
      } finally {
        setSigningPath((cur) => (cur === entry.storagePath ? null : cur));
        delete inFlightRef.current[entry.storagePath];
      }
    })();

    inFlightRef.current[entry.storagePath] = promise;
    return promise;
  };

  const onOpenFile = async (entry: ExplorerEntry) => {
    // Open a blank tab synchronously while we still have the click gesture —
    // async window.open after fetch is blocked and looks like Open “does nothing”.
    const useLightbox = isImageFileName(entry.name) || isPdfFileName(entry.name);
    const popup = useLightbox ? null : window.open("about:blank", "_blank");

    const url = await resolveUrl(entry, "open");
    if (!url) {
      try {
        popup?.close();
      } catch {
        /* ignore */
      }
      return;
    }

    if (isImageFileName(entry.name)) {
      setPreview({ entry, url, kind: "image" });
      setStatus(null);
      return;
    }
    if (isPdfFileName(entry.name)) {
      setPreview({ entry, url, kind: "pdf" });
      setStatus(null);
      return;
    }

    try {
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setStatus(`Opened ${entry.name}`);
      window.setTimeout(() => setStatus(null), 1800);
    } catch (err) {
      try {
        popup?.close();
      } catch {
        /* ignore */
      }
      setSignError(plainOfficeDownloadFailure(err));
      setStatus(null);
    }
  };

  const onDownloadFile = async (entry: ExplorerEntry) => {
    setStatus(`Starting download: ${entry.name}…`);
    setSignError(null);
    try {
      const fileMeta = data.files.find((f) => f.path === entry.storagePath);
      const blob = await fetchOfficeFileBlob(jobId, entry.storagePath, {
        totalChunks: fileMeta?.totalChunks,
        meterDownload: true,
        source: data.source ?? null,
      });
      const outcome = await saveBlobWithSaveAs(blob, entry.name);
      if (outcome.kind === "cancelled") {
        setStatus("Download cancelled.");
        window.setTimeout(() => setStatus(null), 2200);
        return;
      }
      setStatus(outcome.message);
      window.setTimeout(() => setStatus(null), outcome.mode === "fallback" ? 8000 : 3200);
    } catch (err) {
      setSignError(plainOfficeDownloadFailure(err));
      setStatus(null);
    }
  };

  const onPackageDownload = async () => {
    if (packageBusy) return;
    if (!data.storageLinksAvailable) {
      setSignError(
        "Download isn’t available right now. Tell whoever runs the Netlify site to check the latest deploy.",
      );
      return;
    }
    if (!data.files.length) {
      setSignError("No files found for this job yet. Ask the field phone to Sync, then Refresh.");
      return;
    }
    const abort = new AbortController();
    packageAbortRef.current = abort;
    setPackageBusy(true);
    setSignError(null);
    const startProgress: OfficePackageProgress = {
      phase: "picking",
      current: 0,
      total: data.files.length,
      percent: 0,
      message: "Starting download to this computer…",
      saveAsName: null,
    };
    setPackageProgress(startProgress);
    setStatus(startProgress.message);
    try {
      await downloadOfficeJobPackage({
        jobId,
        folderName: displayTitle || data.folderName || title,
        source: data.source ?? null,
        files: data.files.map((f) => ({
          path: f.path,
          label: f.label,
          sizeBytes: f.sizeBytes,
          totalChunks: f.totalChunks,
          source: data.source ?? null,
        })),
        signal: abort.signal,
        onProgress: (progress) => {
          setPackageProgress(progress);
          setStatus(progress.message);
        },
      });
      window.setTimeout(() => {
        setStatus(null);
        setPackageProgress(null);
      }, 8000);
    } catch (err) {
      if (err instanceof OfficeSaveCancelledError) {
        setStatus("Download cancelled.");
        setSignError(null);
        setPackageProgress(null);
        window.setTimeout(() => setStatus(null), 2200);
        return;
      }
      const msg = plainOfficeDownloadFailure(err);
      setSignError(msg);
      setStatus(null);
      setPackageProgress(null);
    } finally {
      setPackageBusy(false);
      packageAbortRef.current = null;
    }
  };

  useEffect(() => {
    registerPackageDownload?.(() => {
      void onPackageDownload();
    });
    return () => registerPackageDownload?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep chrome toolbar wired to latest download
  }, [jobId, data.files, data.storageLinksAvailable, registerPackageDownload]);

  useEffect(() => {
    if (!autoPackageDownload || packageBusy) return;
    void onPackageDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when opened via list Download
  }, [autoPackageDownload, jobId]);

  const previewIndex = preview
    ? imageFiles.findIndex((f) => f.storagePath === preview.entry.storagePath)
    : -1;

  const imageFilesRef = useRef(imageFiles);
  imageFilesRef.current = imageFiles;
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const showAdjacent = async (delta: number) => {
    const imgs = imageFilesRef.current;
    const cur = previewRef.current;
    if (!cur || cur.kind !== "image" || imgs.length === 0) return;
    const idx = imgs.findIndex((f) => f.storagePath === cur.entry.storagePath);
    if (idx < 0) return;
    const next = imgs[(idx + delta + imgs.length) % imgs.length];
    if (!next) return;
    setStatus(`Loading ${next.name}…`);
    const url = await resolveUrl(next, "open");
    if (!url) return;
    setPreview({ entry: next, url, kind: "image" });
    setStatus(null);
  };

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
      if (preview.kind === "image") {
        if (e.key === "ArrowRight") void showAdjacent(1);
        if (e.key === "ArrowLeft") void showAdjacent(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.entry.storagePath, preview?.kind]);

  useEffect(() => () => setStatus(null), []);

  const hasListRows = folders.length > 0 || otherFiles.length > 0;
  const alertBox: CSSProperties = {
    background: "#fdf4e0",
    border: "1px solid #f0dfae",
    padding: "8px 10px",
    marginBottom: 8,
    fontSize: 13,
    color: "#5c4210",
    lineHeight: 1.45,
  };

  return (
    <div style={shell}>
      <header
        style={{
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: `1px solid ${PGG.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <h1
            style={{
              fontSize: embedded ? 15 : 16,
              margin: 0,
              fontWeight: 600,
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            {displayTitle}
          </h1>
          <button
            type="button"
            className={`${OFFICE_BTN_CLASS}${nameBusy ? " is-busy" : ""}`}
            onClick={() => void onEditName()}
            disabled={nameBusy}
            title="Edit customer / job name"
            style={btnSecondary}
          >
            {nameBusy ? "Saving…" : "Edit name"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: PGG.muted, margin: 0, lineHeight: 1.4 }}>
          Last synced: <strong style={{ color: PGG.ink }}>{formatSyncedAt(data.syncedAt)}</strong>
          {" · "}From: <strong style={{ color: PGG.ink }}>{fromLabel(data.syncedFrom)}</strong>
          {data.uploadKind === "office-sync" ? " · Field sync" : null}
          {" · "}
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{jobId}</span>
        </p>
      </header>

      <OfficeDesktopReminder compact />

      {!data.storageLinksAvailable && (
        <section style={alertBox}>
          <p style={{ margin: 0 }}>
            File list and Download need the shared office list token on Netlify and a Lovable
            Publish of the job list / sign APIs. Do not add storage service keys on Netlify. Ask
            whoever manages the site to fix that, then Refresh.
          </p>
        </section>
      )}

      {data.storageLinksAvailable && data.syncIncomplete && (
        <section style={alertBox}>
          <p style={{ margin: 0 }}>
            <strong>Sync looks incomplete.</strong>{" "}
            {data.manifestExpectedFiles != null
              ? `Manifest lists ${data.manifestExpectedFiles} files; ${data.storageObjectCount} are in storage`
              : `${data.storageObjectCount} files in storage`}
            {data.missingManifestPaths > 0
              ? ` (${data.missingManifestPaths} missing from manifest paths)`
              : ""}
            . On the phone: ⋯ → <strong>Sync to office</strong> → <strong>Resume sync</strong>.
          </p>
        </section>
      )}

      {data.storageLinksAvailable && data.kind === "empty" && !data.syncIncomplete && (
        <p style={{ fontSize: 13, color: PGG.bad }}>No files found for this job yet.</p>
      )}

      {signError && (
        <p style={{ color: PGG.bad, fontSize: 12, margin: "0 0 8px" }} role="alert">
          {signError}
        </p>
      )}

      {data.storageLinksAvailable && data.files.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              fontSize: 12,
              color: PGG.muted,
            }}
          >
            <span>
              {data.files.length} file{data.files.length === 1 ? "" : "s"}
              {imageFiles.length > 0
                ? ` · ${imageFiles.length} photo${imageFiles.length === 1 ? "" : "s"}`
                : ""}
              {data.kind === "zip-parts" ? " (ZIP parts)" : ""}
            </span>
            <button
              type="button"
              className={`${OFFICE_BTN_CLASS}${packageBusy ? " is-busy" : ""}`}
              style={{ ...btnSecondary, display: "inline-flex" }}
              onClick={() => void onPackageDownload()}
              disabled={packageBusy}
            >
              {packageBusy ? "Downloading…" : "Download package"}
            </button>
            {data.kind === "manifest" && (
              <button
                type="button"
                className={OFFICE_BTN_CLASS}
                style={btnSecondary}
                onClick={() => setNotesOpen(true)}
                title="Edit pin descriptions / notes for this job"
              >
                Edit notes
              </button>
            )}
          </div>

          {packageProgress && (
            <section
              aria-live="polite"
              aria-busy={packageBusy}
              role="status"
              style={{
                marginBottom: 12,
                padding: "12px 14px",
                border: `1px solid ${PGG.selectBorder}`,
                background: PGG.accentSoft,
                boxShadow: PGG.shadow,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: PGG.ink,
                      lineHeight: 1.35,
                    }}
                  >
                    {packageProgress.phase === "done"
                      ? "Saved on this computer"
                      : packageProgress.phase === "picking"
                        ? "Save As — pick a folder on this computer"
                        : packageProgress.phase === "loading"
                          ? "Preparing download to this computer"
                          : `Downloading to ${
                              packageProgress.saveAsName?.trim() || "this computer"
                            }`}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      fontWeight: 600,
                      color: PGG.ink,
                      lineHeight: 1.4,
                    }}
                  >
                    {packageProgress.phase === "downloading" && packageProgress.total > 0
                      ? `${packageProgress.current} of ${packageProgress.total} (${packageProgress.percent}%)`
                      : packageProgress.message}
                  </p>
                  {packageProgress.phase === "downloading" && packageProgress.saveAsName ? (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 12,
                        color: PGG.muted,
                        lineHeight: 1.35,
                      }}
                    >
                      Writing ZIP to the file you chose — not uploading to the office server.
                    </p>
                  ) : packageBusy ? (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 12,
                        color: PGG.muted,
                        lineHeight: 1.35,
                      }}
                    >
                      This is a download to your PC. It is not an upload to the office server.
                    </p>
                  ) : null}
                </div>
                {packageBusy && (
                  <button
                    type="button"
                    className={OFFICE_BTN_CLASS}
                    style={{ ...btnSecondary, flexShrink: 0 }}
                    onClick={onCancelPackage}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div
                style={{
                  height: 14,
                  width: "100%",
                  borderRadius: 2,
                  background: PGG.paper,
                  border: `1px solid ${PGG.line}`,
                  overflow: "hidden",
                  position: "relative",
                }}
                aria-hidden
              >
                {packageProgress.phase === "picking" || packageProgress.phase === "loading" ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "36%",
                      background: PGG.accent,
                      animation: "office-package-indeterminate 1.15s ease-in-out infinite",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(packageProgress.percent, packageBusy ? 2 : 0)}%`,
                      background: PGG.accent,
                      transition: "width .2s ease",
                    }}
                  />
                )}
              </div>
              <style>{`
                @keyframes office-package-indeterminate {
                  0% { transform: translateX(-10%); }
                  100% { transform: translateX(280%); }
                }
              `}</style>
            </section>
          )}

          {data.kind === "manifest" && (
            <nav
              aria-label="Folder path"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
                fontSize: 12,
                padding: "4px 8px",
                background: PGG.bg,
                border: `1px solid ${PGG.line}`,
              }}
            >
              <button
                type="button"
                className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
                onClick={() => setDirPath("")}
                style={{
                  border: 0,
                  background: "transparent",
                  color: dirPath ? PGG.accent : PGG.ink,
                  fontWeight: dirPath ? 600 : 700,
                  cursor: "pointer",
                  padding: "1px 3px",
                }}
              >
                {displayTitle || "Job root"}
              </button>
              {breadcrumbs.map((segment, i) => {
                const path = breadcrumbs.slice(0, i + 1).join("/");
                return (
                  <span key={path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: PGG.muted }}>›</span>
                    <button
                      type="button"
                      className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
                      onClick={() => setDirPath(path)}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: i === breadcrumbs.length - 1 ? PGG.ink : PGG.accent,
                        fontWeight: i === breadcrumbs.length - 1 ? 700 : 600,
                        cursor: "pointer",
                        padding: "1px 3px",
                      }}
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </nav>
          )}

          {/* Explorer-native folders + non-image files first */}
          {hasListRows && (
            <div
              className="office-explorer-table"
              style={{ overflowX: "auto", marginBottom: imageFiles.length > 0 ? 12 : 0 }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  background: PGG.paper,
                  border: `1px solid ${PGG.line}`,
                }}
                aria-label="Folders and files"
              >
                <thead>
                  <tr>
                    <th className="office-col-header">Name</th>
                    <th className="office-col-header office-col-hide-sm">Type</th>
                    <th className="office-col-header">Size</th>
                    <th className="office-col-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kind === "manifest" &&
                    folders.map((folder) => {
                      const folderKey = `dir:${dirPath ? `${dirPath}/` : ""}${folder}`;
                      const selected = selectedPath === folderKey;
                      return (
                        <tr
                          key={folderKey}
                          className={`office-list-row${selected ? " is-selected" : ""}`}
                          aria-selected={selected}
                          onClick={() => setSelectedPath(folderKey)}
                          onDoubleClick={() =>
                            setDirPath(dirPath ? `${dirPath}/${folder}` : folder)
                          }
                          style={{ borderTop: `1px solid ${PGG.line}` }}
                        >
                          <td style={{ padding: "4px 10px" }} colSpan={1}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontWeight: 600,
                                color: PGG.ink,
                              }}
                            >
                              <FolderIcon />
                              {folder}
                            </span>
                          </td>
                          <td
                            style={{ padding: "4px 10px", color: PGG.muted, whiteSpace: "nowrap" }}
                            className="office-col-hide-sm"
                          >
                            File folder
                          </td>
                          <td style={{ padding: "4px 10px", color: PGG.muted }}>—</td>
                          <td style={{ padding: "4px 10px" }}>
                            <button
                              type="button"
                              className={OFFICE_BTN_CLASS}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDirPath(dirPath ? `${dirPath}/${folder}` : folder);
                              }}
                              style={btnSecondary}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {otherFiles.map((file) => {
                    const busy = signingPath === file.storagePath;
                    const selected = selectedPath === file.storagePath;
                    return (
                      <tr
                        key={file.storagePath}
                        className={`office-list-row${selected ? " is-selected" : ""}`}
                        aria-selected={selected}
                        onClick={() => setSelectedPath(file.storagePath)}
                        onDoubleClick={() => void onOpenFile(file)}
                        style={{ borderTop: `1px solid ${PGG.line}` }}
                      >
                        <td style={{ padding: "4px 10px", maxWidth: 360 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              fontWeight: 600,
                              color: PGG.ink,
                              wordBreak: "break-word",
                            }}
                          >
                            <FileIcon image={false} />
                            {file.name}
                          </span>
                        </td>
                        <td
                          style={{ padding: "4px 10px", color: PGG.muted, whiteSpace: "nowrap" }}
                          className="office-col-hide-sm"
                        >
                          {fileTypeLabel(file.name)}
                        </td>
                        <td style={{ padding: "4px 10px", color: PGG.muted, whiteSpace: "nowrap" }}>
                          {formatFileSize(file.sizeBytes)}
                        </td>
                        <td style={{ padding: "4px 10px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            <button
                              type="button"
                              className={`${OFFICE_BTN_CLASS}${busy ? " is-busy" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onOpenFile(file);
                              }}
                              disabled={busy}
                              style={btnSecondary}
                            >
                              {busy ? "Opening…" : "Open"}
                            </button>
                            <button
                              type="button"
                              className={`${OFFICE_BTN_CLASS}${busy ? " is-busy" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDownloadFile(file);
                              }}
                              disabled={busy}
                              style={btnSecondary}
                            >
                              {busy ? "Working…" : "Download"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {imageFiles.length > 0 && (
            <section
              aria-label="Photo gallery"
              style={{
                border: `1px solid ${PGG.line}`,
                padding: 10,
                marginBottom: 0,
                background: PGG.paper,
              }}
            >
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  color: PGG.muted,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Photos
              </h2>
              <div
                className="office-photo-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                  gap: 8,
                }}
              >
                {imageFiles.map((file) => (
                  <PhotoThumb
                    key={file.storagePath}
                    entry={file}
                    busy={signingPath === file.storagePath}
                    cachedUrl={urlCache[file.storagePath] ?? file.signedUrl}
                    onNeedUrl={() => resolveUrl(file, "thumb")}
                    onOpen={() => {
                      setSelectedPath(file.storagePath);
                      void onOpenFile(file);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <OfficePinNotesEditor
        jobId={jobId}
        source={data.source ?? null}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        onStatusChange={setStatus}
      />

      {preview && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Preview ${preview.entry.name}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(31,27,22,0.88)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "min(100%, 1100px)",
              maxHeight: "92vh",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                color: "#fff",
                fontSize: 14,
                margin: "0 0 10px",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}
            >
              {preview.entry.name}
              {preview.kind === "image" && imageFiles.length > 1 && previewIndex >= 0
                ? ` · ${previewIndex + 1} / ${imageFiles.length}`
                : ""}
            </p>
            <div
              style={{
                position: "relative",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {preview.kind === "image" && imageFiles.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous photo"
                  className={OFFICE_BTN_CLASS}
                  onClick={() => void showAdjacent(-1)}
                  style={{
                    ...btnSecondary,
                    position: "absolute",
                    left: 0,
                    zIndex: 1,
                    background: "rgba(255,255,255,0.95)",
                    minWidth: 44,
                    padding: "12px 14px",
                  }}
                >
                  ‹
                </button>
              )}
              {preview.kind === "pdf" ? (
                <iframe
                  title={preview.entry.name}
                  src={preview.url}
                  style={{
                    width: "100%",
                    height: "72vh",
                    border: 0,
                    borderRadius: 8,
                    background: "#fff",
                  }}
                />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.entry.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "72vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    background: "#111",
                  }}
                />
              )}
              {preview.kind === "image" && imageFiles.length > 1 && (
                <button
                  type="button"
                  aria-label="Next photo"
                  className={OFFICE_BTN_CLASS}
                  onClick={() => void showAdjacent(1)}
                  style={{
                    ...btnSecondary,
                    position: "absolute",
                    right: 0,
                    zIndex: 1,
                    background: "rgba(255,255,255,0.95)",
                    minWidth: 44,
                    padding: "12px 14px",
                  }}
                >
                  ›
                </button>
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className={OFFICE_BTN_CLASS}
                style={{ ...btnSecondary, background: PGG.paper }}
              >
                Open in new tab
              </a>
              <a
                href={preview.url}
                download={preview.entry.name}
                className={OFFICE_BTN_CLASS}
                style={{ ...btnSecondary, background: PGG.paper }}
                onClick={() => {
                  setStatus(`Starting download: ${preview.entry.name}…`);
                  window.setTimeout(() => setStatus(null), 2000);
                }}
              >
                Download
              </a>
              <button
                type="button"
                className={OFFICE_BTN_CLASS}
                onClick={() => setPreview(null)}
                style={btnSecondary}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .office-col-hide-sm { display: none !important; }
          .office-photo-grid {
            grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}

type PhotoThumbProps = {
  entry: ExplorerEntry;
  busy: boolean;
  cachedUrl: string | null;
  onNeedUrl: () => Promise<string | null>;
  onOpen: () => void;
};

/** Lazy-sign when the thumb scrolls into view — never batch-sign on page load. */
function PhotoThumb({ entry, busy, cachedUrl, onNeedUrl, onOpen }: PhotoThumbProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const onNeedUrlRef = useRef(onNeedUrl);
  onNeedUrlRef.current = onNeedUrl;
  const [src, setSrc] = useState<string | null>(cachedUrl);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (cachedUrl) setSrc(cachedUrl);
  }, [cachedUrl]);

  useEffect(() => {
    if (src || requestedRef.current) return;
    const el = rootRef.current;
    if (!el) return;

    const load = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      setLoading(true);
      void onNeedUrlRef.current().then((url) => {
        setLoading(false);
        if (url) setSrc(url);
        else setFailed(true);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }

    const io = new IntersectionObserver(
      (observed) => {
        if (observed.some((e) => e.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, entry.storagePath]);

  return (
    <button
      ref={rootRef}
      type="button"
      className={`${OFFICE_BTN_CLASS} office-thumb`}
      onClick={onOpen}
      disabled={busy && !src}
      aria-label={`Open ${entry.name}`}
      title={entry.name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        border: `1px solid ${PGG.line}`,
        borderRadius: 4,
        background: PGG.paper,
        padding: 0,
        cursor: busy && !src ? "wait" : "pointer",
        overflow: "hidden",
        textAlign: "left",
        minHeight: 0,
      }}
    >
      <div
        style={{
          aspectRatio: "1 / 1",
          background: PGG.accentSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {src && !failed ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span style={{ color: PGG.muted, fontSize: 12 }}>
            {failed ? "Preview n/a" : loading || busy ? "…" : "Photo"}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          lineHeight: 1.25,
          padding: "6px 8px",
          color: PGG.ink,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.name}
      </span>
    </button>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fill={PGG.accent}
        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
      />
    </svg>
  );
}

function FileIcon({ image }: { image: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      {image ? (
        <path
          fill={PGG.accent}
          d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
        />
      ) : (
        <path
          fill={PGG.muted}
          d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
        />
      )}
    </svg>
  );
}
