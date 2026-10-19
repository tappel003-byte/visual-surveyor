import { downloadZip, makeZip } from "client-zip";
import { officeGetJobDownload, officeSignFile } from "@/lib/office-download.functions";
import {
  fallbackSaveMessage,
  isSaveCancelled,
  openSaveWritable,
  pickerSavedMessage,
  saveBlobWithSaveAs,
  supportsSaveFilePicker,
} from "@/lib/office-save-file";

/** List Download sets this before navigating to the job page. */
export const OFFICE_AUTO_PACKAGE_KEY = "pgg_office_auto_package";

export type OfficePackageFile = {
  path: string;
  label: string;
  sizeBytes?: number | null;
  totalChunks?: number;
};

/** User closed Save As — do not treat as a failed package. */
export class OfficeSaveCancelledError extends Error {
  constructor() {
    super("Download cancelled.");
    this.name = "OfficeSaveCancelledError";
  }
}

/** Plain-English download failures for desk staff. */
export function plainOfficeDownloadFailure(err: unknown): string {
  if (err instanceof OfficeSaveCancelledError || isSaveCancelled(err)) {
    return "Download cancelled.";
  }
  const raw = String(err instanceof Error ? err.message : err || "").toLowerCase();
  if (raw.includes("sign in") || raw.includes("unauthorized") || raw.includes("session")) {
    return "Sign in at /office with the company password, then try Download again.";
  }
  if (raw.includes("not available") || raw.includes("not configured")) {
    return "Download isn’t available right now. Tell whoever runs the Netlify site to check the latest deploy.";
  }
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) {
    return "Couldn’t download. Check your internet, then try Download package again.";
  }
  return "Download package didn’t finish. Try Download package again. Photos stay in staging until Delete.";
}

const CHUNK_FETCH_MAX_ATTEMPTS = 5;
/** Extra whole-file retries so a flaky file doesn’t abort a 100+ file package. */
const FILE_FETCH_MAX_ATTEMPTS = 4;

function safeZipPath(rootName: string, label: string): string {
  const safeRoot = rootName.replace(/[/\\]+/g, "_").replace(/^\.+/, "") || "field-export";
  const safeLabel = label.replace(/^[/\\]+/, "").replace(/\.\./g, "_") || "file";
  return `${safeRoot}/${safeLabel}`;
}

function safeZipFilename(rootName: string): string {
  const base = rootName.replace(/[/\\?%*:|"<>]+/g, "_").trim() || "field-export";
  return `${base}.zip`;
}

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

async function fetchOfficeFileBlobResilient(
  jobId: string,
  file: OfficePackageFile,
  onChunk?: (done: number, total: number) => void,
): Promise<Blob> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < FILE_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOfficeFileBlob(jobId, file.path, {
        totalChunks: file.totalChunks,
        meterDownload: true,
        onChunk,
      });
    } catch (err) {
      lastErr = err;
      if (attempt === FILE_FETCH_MAX_ATTEMPTS - 1) break;
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Could not download ${file.label}`);
}

/**
 * Desk Download package: one ZIP for the whole job + Save As (Chromium).
 * Streams files into the ZIP as they arrive so the browser never holds the full
 * job as separate downloads, and Save As runs before bytes are committed.
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
  const zipFilename = safeZipFilename(rootName);
  const total = files.length;

  const zipEntries = () =>
    (async function* () {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        opts.onProgress?.(`Downloading ${i + 1} of ${total}…`);
        const blob = await fetchOfficeFileBlobResilient(jobId, f, (done, chunkTotal) => {
          if (chunkTotal > 1) {
            opts.onProgress?.(
              `Downloading ${i + 1} of ${total} (piece ${done}/${chunkTotal})…`,
            );
          }
        });
        yield {
          name: safeZipPath(rootName, f.label),
          lastModified: new Date(),
          input: blob,
        };
      }
    })();

  // Prefer Save As first, then stream the ZIP straight into that file (harden large jobs).
  if (supportsSaveFilePicker()) {
    opts.onProgress?.("Choose where to save the ZIP…");
    try {
      const { filename, writable } = await openSaveWritable(zipFilename, "application/zip", ".zip");
      try {
        opts.onProgress?.(`Downloading 1 of ${total}…`);
        await makeZip(zipEntries()).pipeTo(writable);
        opts.onProgress?.(pickerSavedMessage(filename));
        return;
      } catch (err) {
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
        if (isSaveCancelled(err)) throw new OfficeSaveCancelledError();
        throw err;
      }
    } catch (err) {
      if (err instanceof OfficeSaveCancelledError || isSaveCancelled(err)) {
        throw new OfficeSaveCancelledError();
      }
      // No user gesture (auto-start) or picker blocked — fall through to build-then-save.
    }
  }

  // Anchor / late Save As path: stream files into one ZIP blob, then save.
  const blob = await downloadZip(zipEntries()).blob();
  opts.onProgress?.("Choose where to save the ZIP…");
  const outcome = await saveBlobWithSaveAs(blob, zipFilename, {
    mimeType: "application/zip",
    extension: ".zip",
  });
  if (outcome.kind === "cancelled") throw new OfficeSaveCancelledError();
  opts.onProgress?.(
    outcome.mode === "fallback" ? fallbackSaveMessage(outcome.filename) : outcome.message,
  );
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
