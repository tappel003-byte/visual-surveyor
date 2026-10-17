import { useEffect, useMemo, useRef, useState } from "react";
import type { OfficeJobDownloadResult } from "@/lib/office-download.functions";
import { officeSignFile } from "@/lib/office-download.functions";
import {
  fileTypeLabel,
  isImageFileName,
  listDirectory,
  toExplorerEntries,
  type ExplorerEntry,
} from "@/lib/office-file-tree";
import { fromLabel } from "@/components/office/OfficeChrome";

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
  padding: "12px 14px 28px",
  fontFamily: "Segoe UI, system-ui, sans-serif",
  color: "#1a1a1a",
} as const;

const btnSecondary = {
  padding: "7px 12px",
  border: "1px solid #8a8a8a",
  borderRadius: 4,
  background: "#fff",
  color: "#1a1a1a",
  fontSize: 13,
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
};

export function JobFileExplorer({ jobId, title, data, embedded }: Props) {
  const [dirPath, setDirPath] = useState("");
  const [preview, setPreview] = useState<{ entry: ExplorerEntry; url: string } | null>(null);
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});
  const urlCacheRef = useRef(urlCache);
  urlCacheRef.current = urlCache;
  const [signingPath, setSigningPath] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const inFlightRef = useRef<Record<string, Promise<string | null>>>({});

  const entries = useMemo(() => toExplorerEntries(data.files), [data.files]);
  const { folders, files } = useMemo(() => listDirectory(entries, dirPath), [entries, dirPath]);

  const imageFiles = useMemo(() => files.filter((f) => isImageFileName(f.name)), [files]);
  const otherFiles = useMemo(() => files.filter((f) => !isImageFileName(f.name)), [files]);

  const breadcrumbs = dirPath ? dirPath.split("/") : [];

  const resolveUrl = async (entry: ExplorerEntry): Promise<string | null> => {
    if (entry.signedUrl) return entry.signedUrl;
    const cached = urlCacheRef.current[entry.storagePath];
    if (cached) return cached;

    const existing = inFlightRef.current[entry.storagePath];
    if (existing) return existing;

    const promise = (async () => {
      setSigningPath(entry.storagePath);
      setSignError(null);
      try {
        const result = await officeSignFile({
          data: { jobId, path: entry.storagePath },
        });
        setUrlCache((prev) => {
          const next = { ...prev, [entry.storagePath]: result.signedUrl };
          urlCacheRef.current = next;
          return next;
        });
        return result.signedUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not open file.";
        setSignError(msg);
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
    const url = await resolveUrl(entry);
    if (!url) return;
    if (isImageFileName(entry.name)) {
      setPreview({ entry, url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const onDownloadFile = async (entry: ExplorerEntry) => {
    const url = await resolveUrl(entry);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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
    if (!cur || imgs.length === 0) return;
    const idx = imgs.findIndex((f) => f.storagePath === cur.entry.storagePath);
    if (idx < 0) return;
    const next = imgs[(idx + delta + imgs.length) % imgs.length];
    if (!next) return;
    const url = await resolveUrl(next);
    if (!url) return;
    setPreview({ entry: next, url });
  };

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
      if (e.key === "ArrowRight") void showAdjacent(1);
      if (e.key === "ArrowLeft") void showAdjacent(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // showAdjacent closes over stable refs + resolveUrl identity is fine for mount of preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.entry.storagePath]);

  const hasListRows = folders.length > 0 || otherFiles.length > 0;

  return (
    <div style={shell}>
      <header style={{ marginBottom: 14 }}>
        {!embedded && <h1 style={{ fontSize: 20, margin: "0 0 4px", fontWeight: 600 }}>{title}</h1>}
        {embedded && <h1 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 600 }}>{title}</h1>}
        <p
          style={{
            fontSize: 12,
            color: "#5f5f5f",
            margin: 0,
            wordBreak: "break-all",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {jobId}
        </p>
        <p style={{ fontSize: 13, color: "#5f5f5f", margin: "8px 0 0", lineHeight: 1.45 }}>
          Last synced: <strong>{formatSyncedAt(data.syncedAt)}</strong>
          {" · "}From: <strong>{fromLabel(data.syncedFrom)}</strong>
          {data.uploadKind === "office-sync" ? " · Field sync" : null}
        </p>
      </header>

      {!data.storageLinksAvailable && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 8,
            padding: "14px 12px",
            background: "#fff8f0",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5, margin: 0 }}>
            File list needs <code>EXPORTS_LIST_TOKEN</code> on Netlify and a Lovable Publish of{" "}
            <code>/api/public/exports-job</code> (and <code>exports-sign</code> for Open). See{" "}
            <code>docs/nlf-office-lovable-publish.md</code>. You can still use the{" "}
            <a href={data.getPagePath} style={{ color: "#0b57d0", fontWeight: 600 }}>
              package download
            </a>{" "}
            (<code>/get?job=</code>). Do not add Supabase service-role keys on Netlify.
          </p>
        </section>
      )}

      {data.storageLinksAvailable && data.syncIncomplete && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 8,
            padding: "12px",
            background: "#fff8f0",
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.5, margin: 0 }}>
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
        <p style={{ fontSize: 14, color: "#a33" }}>No files found for this job yet.</p>
      )}

      {signError && (
        <p style={{ color: "#a33", fontSize: 13, margin: "0 0 10px" }} role="alert">
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
              gap: 10,
              marginBottom: 12,
              fontSize: 13,
              color: "#5f5f5f",
            }}
          >
            <span>
              {data.files.length} file{data.files.length === 1 ? "" : "s"}
              {imageFiles.length > 0
                ? ` · ${imageFiles.length} photo${imageFiles.length === 1 ? "" : "s"}`
                : ""}
              {data.kind === "zip-parts" ? " (ZIP parts)" : ""}
              {" · "}
              Thumbnails / opens signed on demand (~{Math.round(data.signedUrlTtlSeconds / 60)} min)
            </span>
            <a href={data.getPagePath} style={{ ...btnSecondary, display: "inline-block" }}>
              Download package
            </a>
          </div>

          {data.kind === "manifest" && (
            <nav
              aria-label="Folder path"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
                fontSize: 13,
                padding: "8px 10px",
                background: "#f3f3f3",
                border: "1px solid #d4d4d4",
                borderRadius: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setDirPath("")}
                style={{
                  border: 0,
                  background: "transparent",
                  color: dirPath ? "#0b57d0" : "#1a1a1a",
                  fontWeight: dirPath ? 600 : 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {data.folderName || "Job root"}
              </button>
              {breadcrumbs.map((segment, i) => {
                const path = breadcrumbs.slice(0, i + 1).join("/");
                return (
                  <span key={path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#8a8a8a" }}>›</span>
                    <button
                      type="button"
                      onClick={() => setDirPath(path)}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: i === breadcrumbs.length - 1 ? "#1a1a1a" : "#0b57d0",
                        fontWeight: i === breadcrumbs.length - 1 ? 700 : 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </nav>
          )}

          {imageFiles.length > 0 && (
            <section aria-label="Photo gallery" style={{ marginBottom: hasListRows ? 18 : 0 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  margin: "0 0 10px",
                  color: "#3a3a3a",
                }}
              >
                Photos
              </h2>
              <div
                className="office-photo-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
                  gap: 8,
                }}
              >
                {imageFiles.map((file) => (
                  <PhotoThumb
                    key={file.storagePath}
                    entry={file}
                    busy={signingPath === file.storagePath}
                    cachedUrl={urlCache[file.storagePath] ?? file.signedUrl}
                    onNeedUrl={() => resolveUrl(file)}
                    onOpen={() => onOpenFile(file)}
                  />
                ))}
              </div>
            </section>
          )}

          {hasListRows && (
            <div className="office-explorer-table" style={{ overflowX: "auto" }}>
              {imageFiles.length > 0 && (
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    margin: "0 0 10px",
                    color: "#3a3a3a",
                  }}
                >
                  Folders & other files
                </h2>
              )}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  background: "#fff",
                  border: "1px solid #d4d4d4",
                }}
              >
                <thead>
                  <tr style={{ background: "#f3f3f3", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid #d4d4d4", fontWeight: 600 }}>
                      Name
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid #d4d4d4",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                      className="office-col-hide-sm"
                    >
                      Type
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid #d4d4d4",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Size
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid #d4d4d4",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.kind === "manifest" &&
                    folders.map((folder) => (
                      <tr key={`dir-${folder}`} style={{ borderTop: "1px solid #ebebeb" }}>
                        <td style={{ padding: "8px 10px" }} colSpan={4}>
                          <button
                            type="button"
                            onClick={() => setDirPath(dirPath ? `${dirPath}/${folder}` : folder)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              border: 0,
                              background: "transparent",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0b57d0",
                              textAlign: "left",
                            }}
                          >
                            <FolderIcon />
                            {folder}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {otherFiles.map((file) => {
                    const busy = signingPath === file.storagePath;
                    return (
                      <tr key={file.storagePath} style={{ borderTop: "1px solid #ebebeb" }}>
                        <td style={{ padding: "8px 10px", maxWidth: 360 }}>
                          <button
                            type="button"
                            onClick={() => onOpenFile(file)}
                            disabled={busy}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              border: 0,
                              background: "transparent",
                              cursor: busy ? "wait" : "pointer",
                              padding: 0,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0b57d0",
                              textAlign: "left",
                              wordBreak: "break-word",
                            }}
                          >
                            <FileIcon image={false} />
                            {file.name}
                          </button>
                        </td>
                        <td
                          style={{ padding: "8px 10px", color: "#5f5f5f", whiteSpace: "nowrap" }}
                          className="office-col-hide-sm"
                        >
                          {fileTypeLabel(file.name)}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#5f5f5f", whiteSpace: "nowrap" }}>
                          {formatFileSize(file.sizeBytes)}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => onOpenFile(file)}
                              disabled={busy}
                              style={btnSecondary}
                            >
                              {busy ? "…" : "Open"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDownloadFile(file)}
                              disabled={busy}
                              style={btnSecondary}
                            >
                              Download
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
        </>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Preview ${preview.entry.name}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
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
              {imageFiles.length > 1 && previewIndex >= 0
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
              {imageFiles.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => void showAdjacent(-1)}
                  style={{
                    ...btnSecondary,
                    position: "absolute",
                    left: 0,
                    zIndex: 1,
                    background: "rgba(255,255,255,0.92)",
                    minWidth: 40,
                    padding: "10px 12px",
                  }}
                  className="office-lightbox-nav"
                >
                  ‹
                </button>
              )}
              <img
                src={preview.url}
                alt={preview.entry.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "72vh",
                  objectFit: "contain",
                  borderRadius: 4,
                  background: "#111",
                }}
              />
              {imageFiles.length > 1 && (
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => void showAdjacent(1)}
                  style={{
                    ...btnSecondary,
                    position: "absolute",
                    right: 0,
                    zIndex: 1,
                    background: "rgba(255,255,255,0.92)",
                    minWidth: 40,
                    padding: "10px 12px",
                  }}
                  className="office-lightbox-nav"
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
                style={{ ...btnSecondary, background: "#fff" }}
              >
                Open in new tab
              </a>
              <a
                href={preview.url}
                download={preview.entry.name}
                style={{ ...btnSecondary, background: "#fff" }}
              >
                Download
              </a>
              <button type="button" onClick={() => setPreview(null)} style={btnSecondary}>
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
            gap: 6px !important;
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
      onClick={onOpen}
      disabled={busy && !src}
      aria-label={`Open ${entry.name}`}
      title={entry.name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        border: "1px solid #d4d4d4",
        borderRadius: 4,
        background: "#f7f7f7",
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
          background: "#e8e8e8",
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
          <span style={{ color: "#8a8a8a", fontSize: 12 }}>
            {failed ? "Preview n/a" : loading || busy ? "…" : "Photo"}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          lineHeight: 1.25,
          padding: "5px 6px",
          color: "#1a1a1a",
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
        fill="#e8a317"
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
          fill="#5b9bd5"
          d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
        />
      ) : (
        <path
          fill="#7a7a7a"
          d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
        />
      )}
    </svg>
  );
}
