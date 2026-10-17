import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { OfficeJobDownloadResult } from "@/lib/office-download.functions";
import {
  isImageFileName,
  listDirectory,
  toExplorerEntries,
  type ExplorerEntry,
} from "@/lib/office-file-tree";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

const shell = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "32px 20px",
  fontFamily: "system-ui, sans-serif",
  color: "#2c241b",
} as const;

const btnSecondary = {
  padding: "8px 14px",
  border: "1px solid #7a4b2a",
  borderRadius: 8,
  background: "#fff",
  color: "#7a4b2a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  flexShrink: 0,
} as const;

type Props = {
  jobId: string;
  title: string;
  data: OfficeJobDownloadResult;
};

export function JobFileExplorer({ jobId, title, data }: Props) {
  const [dirPath, setDirPath] = useState("");
  const [preview, setPreview] = useState<ExplorerEntry | null>(null);

  const entries = useMemo(() => toExplorerEntries(data.files), [data.files]);
  const { folders, files } = useMemo(() => listDirectory(entries, dirPath), [entries, dirPath]);

  const breadcrumbs = dirPath ? dirPath.split("/") : [];
  const showZipShortcut =
    data.kind === "manifest" && data.files.length > 0 && data.files.length <= 120;

  return (
    <div style={shell}>
      <header style={{ marginBottom: 20 }}>
        <Link
          to="/office"
          style={{ fontSize: 13, color: "#7a4b2a", textDecoration: "none", fontWeight: 600 }}
        >
          ← Back to job list
        </Link>
        <h1 style={{ fontSize: 22, margin: "12px 0 4px" }}>{title}</h1>
        <p style={{ fontSize: 12, color: "#8a7a68", margin: 0, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" }}>
          {jobId}
        </p>
        {data.folderName && data.folderName !== title && (
          <p style={{ fontSize: 13, color: "#6b5d4f", margin: "8px 0 0" }}>
            Export folder: <strong>{data.folderName}</strong>
            {data.uploadKind === "office-sync" ? " · Synced from field" : null}
          </p>
        )}
      </header>

      {!data.storageLinksAvailable && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 12,
            padding: "16px 14px",
            background: "#fff8f0",
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
            Per-file signed links need <code>SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> on Netlify. You can still use the legacy{" "}
            <a href={data.getPagePath} style={{ color: "#7a4b2a", fontWeight: 600 }}>
              download page
            </a>{" "}
            (browser ZIP for smaller jobs).
          </p>
        </section>
      )}

      {data.storageLinksAvailable && data.syncIncomplete && (
        <section
          style={{
            border: "1px solid #e8c9a8",
            borderRadius: 12,
            padding: "14px 14px",
            background: "#fff8f0",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5, margin: 0 }}>
            <strong>Sync looks incomplete.</strong>{" "}
            {data.manifestExpectedFiles != null
              ? `Manifest lists ${data.manifestExpectedFiles} files; ${data.storageObjectCount} are in storage`
              : `${data.storageObjectCount} files in storage`}
            {data.missingManifestPaths > 0 ? ` (${data.missingManifestPaths} missing from manifest paths)` : ""}.
            On the phone, open this job → <strong>⋯</strong> → <strong>Sync to office</strong> →{" "}
            <strong>Resume sync</strong> to upload the rest. Nothing here is deleted automatically.
          </p>
        </section>
      )}

      {data.storageLinksAvailable && data.kind === "empty" && !data.syncIncomplete && (
        <p style={{ fontSize: 14, color: "#a33" }}>No files found for this job in exports storage yet.</p>
      )}

      {data.storageLinksAvailable && data.files.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              fontSize: 13,
              color: "#6b5d4f",
            }}
          >
            <span>
              {data.files.length} file{data.files.length === 1 ? "" : "s"}
              {data.kind === "zip-parts" ? " (ZIP parts)" : ""}
              {" · "}
              Links expire in ~{Math.round(data.signedUrlTtlSeconds / 60)} min
            </span>
            {showZipShortcut && (
              <a href={data.getPagePath} style={{ ...btnSecondary, display: "inline-block" }}>
                Download all as ZIP (small jobs)
              </a>
            )}
            {data.files.length > 120 && (
              <span style={{ fontSize: 12, color: "#8a7a68" }}>
                Large job — use per-file links below (not one ZIP).
              </span>
            )}
          </div>

          {data.kind === "manifest" && (
            <nav
              aria-label="Folder path"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <button
                type="button"
                onClick={() => setDirPath("")}
                style={{
                  border: 0,
                  background: "transparent",
                  color: dirPath ? "#7a4b2a" : "#2c241b",
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
                    <span style={{ color: "#8a7a68" }}>/</span>
                    <button
                      type="button"
                      onClick={() => setDirPath(path)}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: i === breadcrumbs.length - 1 ? "#2c241b" : "#7a4b2a",
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

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              border: "1px solid #e5ddd2",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {data.kind === "manifest" &&
              folders.map((folder) => (
                <li key={folder} style={{ borderTop: "1px solid #e5ddd2" }}>
                  <button
                    type="button"
                    onClick={() => setDirPath(dirPath ? `${dirPath}/${folder}` : folder)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "12px 14px",
                      border: 0,
                      background: "#faf7f2",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#7a4b2a",
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 18 }}>📁</span>
                    {folder}
                  </button>
                </li>
              ))}
            {files.map((file) => {
              const image = isImageFileName(file.name);
              return (
                <li
                  key={file.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderTop: "1px solid #e5ddd2",
                  }}
                >
                  {image ? (
                    <button
                      type="button"
                      onClick={() => setPreview(file)}
                      style={{
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      title="View image"
                    >
                      <img
                        src={file.signedUrl}
                        alt=""
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #e5ddd2",
                        }}
                      />
                    </button>
                  ) : (
                    <span aria-hidden style={{ width: 48, textAlign: "center", flexShrink: 0 }}>📄</span>
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {image ? (
                      <button
                        type="button"
                        onClick={() => setPreview(file)}
                        style={{
                          border: 0,
                          background: "transparent",
                          padding: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#7a4b2a",
                          cursor: "pointer",
                          wordBreak: "break-all",
                          textAlign: "left",
                        }}
                      >
                        {file.name}
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, wordBreak: "break-all" }}>{file.name}</span>
                    )}
                    {file.sizeBytes ? (
                      <span style={{ color: "#8a7a68", fontSize: 12 }}> {formatFileSize(file.sizeBytes)}</span>
                    ) : null}
                  </span>
                  <a
                    href={file.signedUrl}
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={btnSecondary}
                  >
                    Download
                  </a>
                  {image && (
                    <a
                      href={file.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...btnSecondary, fontWeight: 500 }}
                    >
                      Open
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Preview ${preview.name}`}
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
            <p style={{ color: "#fff", fontSize: 14, marginBottom: 10 }}>{preview.name}</p>
            <img
              src={preview.signedUrl}
              alt={preview.name}
              style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
            />
            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={preview.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnSecondary, background: "#fff" }}
              >
                Open in new tab
              </a>
              <a href={preview.signedUrl} download={preview.name} style={{ ...btnSecondary, background: "#fff" }}>
                Download
              </a>
              <button type="button" onClick={() => setPreview(null)} style={btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
