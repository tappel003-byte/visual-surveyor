import { useMemo, useState } from "react";
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
  const [signingPath, setSigningPath] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const entries = useMemo(() => toExplorerEntries(data.files), [data.files]);
  const { folders, files } = useMemo(() => listDirectory(entries, dirPath), [entries, dirPath]);

  const breadcrumbs = dirPath ? dirPath.split("/") : [];

  const resolveUrl = async (entry: ExplorerEntry): Promise<string | null> => {
    if (entry.signedUrl) return entry.signedUrl;
    const cached = urlCache[entry.storagePath];
    if (cached) return cached;
    setSigningPath(entry.storagePath);
    setSignError(null);
    try {
      const result = await officeSignFile({
        data: { jobId, path: entry.storagePath },
      });
      setUrlCache((prev) => ({ ...prev, [entry.storagePath]: result.signedUrl }));
      return result.signedUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open file.";
      setSignError(msg);
      return null;
    } finally {
      setSigningPath(null);
    }
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
              {data.kind === "zip-parts" ? " (ZIP parts)" : ""}
              {" · "}
              Links signed when you open or download (~{Math.round(data.signedUrlTtlSeconds / 60)}{" "}
              min)
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

          {/* Desktop table */}
          <div className="office-explorer-table" style={{ overflowX: "auto" }}>
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
                {files.map((file) => {
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
                          <FileIcon image={isImageFileName(file.name)} />
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
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{ maxWidth: "min(100%, 960px)", maxHeight: "90vh", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: "#fff", fontSize: 14, marginBottom: 10 }}>{preview.entry.name}</p>
            <img
              src={preview.url}
              alt={preview.entry.name}
              style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 4 }}
            />
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
        }
      `}</style>
    </div>
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
