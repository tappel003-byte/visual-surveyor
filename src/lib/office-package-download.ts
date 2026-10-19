import { officeGetJobDownload, officeSignFile } from "@/lib/office-download.functions";

/** List Download sets this before navigating to the job page. */
export const OFFICE_AUTO_PACKAGE_KEY = "pgg_office_auto_package";

export type OfficePackageFile = {
  path: string;
  label: string;
  sizeBytes?: number | null;
  totalChunks?: number;
};

/** Plain-English download failures for desk staff. */
export function plainOfficeDownloadFailure(err: unknown): string {
  const raw = String(err instanceof Error ? err.message : err || "").toLowerCase();
  if (raw.includes("sign in") || raw.includes("unauthorized") || raw.includes("session")) {
    return "Sign in at /office with the company password, then try Download again.";
  }
  if (raw.includes("not available") || raw.includes("not configured")) {
    return "Download isn’t available right now. Tell whoever runs the Netlify site to check the latest deploy.";
  }
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) {
    return "Couldn’t download. Check your internet, then try Download again.";
  }
  return "Couldn’t download this job. Try downloading files one at a time. Photos stay in staging until Delete.";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const CHUNK_FETCH_MAX_ATTEMPTS = 5;

/**
 * Fetch one file as a Blob via ≤4 MB same-origin chunks (session cookie).
 * Releases each chunk after appending — never holds a whole job in memory.
 */
export async function fetchOfficeFileBlob(
  jobId: string,
  path: string,
  opts?: {
    totalChunks?: number;
    /** When true, counts bytes toward the /office “Downloaded this month” estimate. */
    meterDownload?: boolean;
    onChunk?: (done: number, total: number) => void;
  },
): Promise<Blob> {
  const access = await officeSignFile({ data: { jobId, path } });
  const totalChunks = opts?.totalChunks || access.totalChunks || 1;
  const parts: BlobPart[] = [];
  let contentType = "application/octet-stream";

  for (let index = 0; index < totalChunks; index++) {
    let body: ArrayBuffer | null = null;
    for (let attempt = 0; attempt < CHUNK_FETCH_MAX_ATTEMPTS && !body; attempt++) {
      try {
        const url =
          `/api/office/file-chunk?jobId=${encodeURIComponent(jobId)}` +
          `&path=${encodeURIComponent(path)}` +
          `&index=${index}` +
          (opts?.meterDownload ? "&meter=1" : "");
        const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        contentType = res.headers.get("content-type") || contentType;
        body = await res.arrayBuffer();
      } catch (err) {
        if (attempt === CHUNK_FETCH_MAX_ATTEMPTS - 1) throw err;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (!body) throw new Error(`Could not download chunk ${index + 1} of ${path}`);
    parts.push(body);
    opts?.onChunk?.(index + 1, totalChunks);
  }

  return new Blob(parts, { type: contentType });
}

/**
 * Per-file Download to disk (preferred over giant ZIP).
 * Streams each file via chunks; saves one file at a time so the desk never
 * holds the whole job in memory.
 */
export async function downloadOfficeJobPackage(opts: {
  jobId: string;
  folderName?: string | null;
  files?: OfficePackageFile[];
  onProgress?: (message: string) => void;
}): Promise<void> {
  const jobId = opts.jobId.trim();
  if (!jobId) throw new Error("No job selected.");

  let files = opts.files?.filter((f) => f.path && f.label) ?? [];
  let folderName = opts.folderName?.trim() || null;

  if (!files.length) {
    opts.onProgress?.("Loading file list…");
    const payload = await officeGetJobDownload({ data: { jobId } });
    if (!payload.storageLinksAvailable) {
      throw new Error("Download is not available right now.");
    }
    if (!payload.files.length) {
      throw new Error("No files found for this job yet.");
    }
    files = payload.files.map((f) => ({
      path: f.path,
      label: f.label,
      sizeBytes: f.sizeBytes,
      totalChunks: f.totalChunks,
    }));
    folderName = payload.folderName || folderName;
  }

  const rootName = folderName || "field-export";

  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    opts.onProgress?.(`Downloading file ${i + 1} of ${files.length}: ${f.label}…`);
    const blob = await fetchOfficeFileBlob(jobId, f.path, {
      totalChunks: f.totalChunks,
      meterDownload: true,
      onChunk: (done, total) => {
        if (total > 1) {
          opts.onProgress?.(
            `Downloading file ${i + 1} of ${files.length}: ${f.label} (piece ${done}/${total})…`,
          );
        }
      },
    });
    const safeName = f.label.replace(/[/\\]/g, "_");
    saveBlob(blob, `${rootName}__${safeName}`);
    // Brief gap so the browser can flush each download.
    await new Promise((r) => setTimeout(r, 200));
  }

  opts.onProgress?.(`Done — ${files.length} file${files.length === 1 ? "" : "s"} saved. Check your downloads folder.`);
}

/** Build an object URL for Open / lightbox (one file, chunked). */
export async function officeFileObjectUrl(
  jobId: string,
  path: string,
  totalChunks?: number,
): Promise<string> {
  const blob = await fetchOfficeFileBlob(jobId, path, { totalChunks });
  return URL.createObjectURL(blob);
}
