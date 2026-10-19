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
  source?: "blobs" | "lovable" | null;
};

/** User closed Save As — do not treat as a failed package. */
export class OfficeSaveCancelledError extends Error {
  constructor() {
    super("Download cancelled.");
    this.name = "OfficeSaveCancelledError";
  }
}

/** Structured progress for the /office Download package meter. */
export type OfficePackageProgress = {
  phase: "loading" | "picking" | "downloading" | "done";
  /** Current file number (1-based while downloading), or 0 before start. */
  current: number;
  total: number;
  /** 0–100 for the progress bar. */
  percent: number;
  /** Plain-English line for status + meter (always says download to this PC). */
  message: string;
  /** Save As filename once the user picked a place. */
  saveAsName?: string | null;
};

function packageDestLabel(saveAsName?: string | null): string {
  const name = saveAsName?.trim();
  return name ? name : "this computer";
}

/** e.g. “Downloading to this computer: 3 of 108 (3%)” */
export function formatPackageDownloadProgress(
  current: number,
  total: number,
  saveAsName?: string | null,
  piece?: { done: number; total: number },
): OfficePackageProgress {
  const safeTotal = Math.max(0, total);
  const safeCurrent = Math.max(0, Math.min(current, safeTotal || current));
  const percent = safeTotal <= 0 ? 0 : Math.min(100, Math.round((safeCurrent / safeTotal) * 100));
  const dest = packageDestLabel(saveAsName);
  let message = `Downloading to ${dest}: ${safeCurrent} of ${safeTotal} (${percent}%)`;
  if (piece && piece.total > 1) {
    message += ` — piece ${piece.done}/${piece.total}`;
  }
  return {
    phase: "downloading",
    current: safeCurrent,
    total: safeTotal,
    percent,
    message,
    saveAsName: saveAsName ?? null,
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OfficeSaveCancelledError();
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
 * Fetch one file as a Blob.
 * - Blobs jobs: ≤4 MB same-origin chunks (session cookie).
 * - Lovable locker jobs: one HTTPS signed URL fetch.
 */
export async function fetchOfficeFileBlob(
  jobId: string,
  path: string,
  opts?: {
    totalChunks?: number;
    /** When true, counts bytes toward the /office “Downloaded this month” estimate. */
    meterDownload?: boolean;
    onChunk?: (done: number, total: number) => void;
    source?: "blobs" | "lovable" | null;
    signal?: AbortSignal;
  },
): Promise<Blob> {
  throwIfAborted(opts?.signal);
  const access = await officeSignFile({
    data: { jobId, path, source: opts?.source ?? null },
  });
  throwIfAborted(opts?.signal);

  // Old Lovable locker: direct signed HTTPS URL (not same-origin chunks).
  if (access.access === "signed" || /^https?:\/\//i.test(access.signedUrl)) {
    let lastErr: unknown;
    for (let attempt = 0; attempt < CHUNK_FETCH_MAX_ATTEMPTS; attempt++) {
      throwIfAborted(opts?.signal);
      try {
        const res = await fetch(access.signedUrl, {
          cache: "no-store",
          signal: opts?.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        opts?.onChunk?.(1, 1);
        return await res.blob();
      } catch (err) {
        if (isSaveCancelled(err) || opts?.signal?.aborted) throw new OfficeSaveCancelledError();
        lastErr = err;
        if (attempt === CHUNK_FETCH_MAX_ATTEMPTS - 1) break;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`Could not download ${path}`);
  }

  const totalChunks = opts?.totalChunks || access.totalChunks || 1;
  const parts: BlobPart[] = [];
  let contentType = "application/octet-stream";

  for (let index = 0; index < totalChunks; index++) {
    throwIfAborted(opts?.signal);
    let body: ArrayBuffer | null = null;
    for (let attempt = 0; attempt < CHUNK_FETCH_MAX_ATTEMPTS && !body; attempt++) {
      throwIfAborted(opts?.signal);
      try {
        const url =
          `/api/office/file-chunk?jobId=${encodeURIComponent(jobId)}` +
          `&path=${encodeURIComponent(path)}` +
          `&index=${index}` +
          (opts?.meterDownload ? "&meter=1" : "");
        const res = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: opts?.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        contentType = res.headers.get("content-type") || contentType;
        body = await res.arrayBuffer();
      } catch (err) {
        if (isSaveCancelled(err) || opts?.signal?.aborted) throw new OfficeSaveCancelledError();
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
  signal?: AbortSignal,
): Promise<Blob> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < FILE_FETCH_MAX_ATTEMPTS; attempt++) {
    throwIfAborted(signal);
    try {
      return await fetchOfficeFileBlob(jobId, file.path, {
        totalChunks: file.totalChunks,
        meterDownload: true,
        onChunk,
        source: file.source,
        signal,
      });
    } catch (err) {
      if (err instanceof OfficeSaveCancelledError || isSaveCancelled(err) || signal?.aborted) {
        throw new OfficeSaveCancelledError();
      }
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
 *
 * Progress wording is always “downloading to this computer / chosen file” —
 * never upload-to-server language.
 */
export async function downloadOfficeJobPackage(opts: {
  jobId: string;
  folderName?: string | null;
  files?: OfficePackageFile[];
  source?: "blobs" | "lovable" | null;
  onProgress?: (progress: OfficePackageProgress) => void;
  /** Cancel mid-package (AbortController). */
  signal?: AbortSignal;
}): Promise<void> {
  const jobId = opts.jobId.trim();
  if (!jobId) throw new Error("No job selected.");
  throwIfAborted(opts.signal);

  let files = opts.files?.filter((f) => f.path && f.label) ?? [];
  let folderName = opts.folderName?.trim() || null;
  let source = opts.source ?? null;
  let saveAsName: string | null = null;

  const report = (progress: OfficePackageProgress) => {
    opts.onProgress?.(progress);
  };

  if (!files.length) {
    report({
      phase: "loading",
      current: 0,
      total: 0,
      percent: 0,
      message: "Loading file list for download to this computer…",
      saveAsName: null,
    });
    const payload = await officeGetJobDownload({ data: { jobId, source } });
    throwIfAborted(opts.signal);
    if (!payload.storageLinksAvailable) {
      throw new Error("Download is not available right now.");
    }
    if (!payload.files.length) {
      throw new Error("No files found for this job yet.");
    }
    source = payload.source || source;
    files = payload.files.map((f) => ({
      path: f.path,
      label: f.label,
      sizeBytes: f.sizeBytes,
      totalChunks: f.totalChunks,
      source,
    }));
    folderName = payload.folderName || folderName;
  } else if (source) {
    files = files.map((f) => ({ ...f, source: f.source ?? source }));
  }

  const rootName = folderName || "field-export";
  const zipFilename = safeZipFilename(rootName);
  const total = files.length;

  const zipEntries = () =>
    (async function* () {
      for (let i = 0; i < files.length; i++) {
        throwIfAborted(opts.signal);
        const f = files[i]!;
        const current = i + 1;
        report(formatPackageDownloadProgress(current, total, saveAsName));
        const blob = await fetchOfficeFileBlobResilient(
          jobId,
          f,
          (done, chunkTotal) => {
            if (chunkTotal > 1) {
              report(
                formatPackageDownloadProgress(current, total, saveAsName, {
                  done,
                  total: chunkTotal,
                }),
              );
            }
          },
          opts.signal,
        );
        yield {
          name: safeZipPath(rootName, f.label),
          lastModified: new Date(),
          input: blob,
        };
      }
    })();

  // Prefer Save As first, then stream the ZIP straight into that file (harden large jobs).
  if (supportsSaveFilePicker()) {
    report({
      phase: "picking",
      current: 0,
      total,
      percent: 0,
      message: "Choose where to save the ZIP on this computer…",
      saveAsName: null,
    });
    try {
      const { filename, writable } = await openSaveWritable(zipFilename, "application/zip", ".zip");
      throwIfAborted(opts.signal);
      saveAsName = filename;
      try {
        report(formatPackageDownloadProgress(1, total, saveAsName));
        await makeZip(zipEntries()).pipeTo(writable, { signal: opts.signal });
        report({
          phase: "done",
          current: total,
          total,
          percent: 100,
          message: pickerSavedMessage(filename),
          saveAsName: filename,
        });
        return;
      } catch (err) {
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
        if (
          err instanceof OfficeSaveCancelledError ||
          isSaveCancelled(err) ||
          opts.signal?.aborted
        ) {
          throw new OfficeSaveCancelledError();
        }
        throw err;
      }
    } catch (err) {
      if (err instanceof OfficeSaveCancelledError || isSaveCancelled(err) || opts.signal?.aborted) {
        throw new OfficeSaveCancelledError();
      }
      // No user gesture (auto-start) or picker blocked — fall through to build-then-save.
    }
  }

  // Anchor / late Save As path: stream files into one ZIP blob, then save.
  throwIfAborted(opts.signal);
  const blob = await downloadZip(zipEntries()).blob();
  throwIfAborted(opts.signal);
  report({
    phase: "picking",
    current: total,
    total,
    percent: 100,
    message: "Choose where to save the ZIP on this computer…",
    saveAsName: null,
  });
  const outcome = await saveBlobWithSaveAs(blob, zipFilename, {
    mimeType: "application/zip",
    extension: ".zip",
  });
  if (outcome.kind === "cancelled") throw new OfficeSaveCancelledError();
  report({
    phase: "done",
    current: total,
    total,
    percent: 100,
    message: outcome.mode === "fallback" ? fallbackSaveMessage(outcome.filename) : outcome.message,
    saveAsName: outcome.filename,
  });
}

/** Build an object URL for Open / lightbox (one file, chunked or signed). */
export async function officeFileObjectUrl(
  jobId: string,
  path: string,
  totalChunks?: number,
  source?: "blobs" | "lovable" | null,
): Promise<string> {
  const blob = await fetchOfficeFileBlob(jobId, path, { totalChunks, source });
  return URL.createObjectURL(blob);
}
