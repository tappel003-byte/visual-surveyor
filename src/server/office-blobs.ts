/**
 * Site-wide Netlify Blobs locker for temporary Sync → /office staging.
 * NOT deploy-scoped — files must survive publishes.
 *
 * Files are stored as ≤4 MB raw chunks at rest so Download can stream
 * piece-by-piece without holding a whole file (or job) in memory.
 */
import { getStore, type Store } from "@netlify/blobs";

export const OFFICE_LOCKER_STORE = "pgg-office-locker";

/** ~1 GB temporary locker budget. */
export const LOCKER_BUDGET_BYTES = 1024 * 1024 * 1024;
/** Per-file cap (plain-English reject on Sync). */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
/** Per-job cap. */
export const MAX_JOB_BYTES = 300 * 1024 * 1024;
/** Daily upload budget across all phones (abuse brake). */
export const DAILY_UPLOAD_BUDGET_BYTES = 1500 * 1024 * 1024;
/** Raw binary piece size for Sync + Download (under Netlify ~6 MB function limit). */
export const CHUNK_MAX_BYTES = 4 * 1024 * 1024;
/** Incomplete upload pieces older than this are deleted on list/upload. */
export const INCOMPLETE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Warn on /office near this estimated download volume. */
export const DOWNLOAD_MONTH_WARN_BYTES = 10 * 1024 * 1024 * 1024;

const META_DAILY = "meta/daily-upload.json";
const META_DOWNLOAD_MONTH = "meta/download-month.json";

export type LockerManifest = {
  version?: number;
  folderName?: string;
  uploadKind?: string;
  syncedAt?: string;
  syncedFrom?: string;
  deviceName?: string;
  createdAt?: string;
  totalBytes?: number;
  officeNameEditedAt?: string;
  officeNotesEditedAt?: string;
  files?: Array<{ path: string; zipPath: string; sizeBytes?: number }>;
};

export type JobBlobEntry = {
  relativePath: string;
  sizeBytes: number;
  contentType?: string;
  totalChunks: number;
};

export type FileMeta = {
  path: string;
  sizeBytes: number;
  contentType: string;
  totalChunks: number;
  complete: boolean;
  startedAt: string;
  received: number[];
};

let storeSingleton: Store | null = null;

/**
 * Strong consistency needs `uncachedEdgeURL` in NETLIFY_BLOBS_CONTEXT.
 * Some Netlify runtimes omit it; `@netlify/blobs` then throws BlobsConsistencyError
 * on every read — Sync dies with a generic 500 after the field key checks out.
 */
function blobsSupportsStrongConsistency(): boolean {
  try {
    const globalCtx = (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext;
    const raw =
      (typeof globalCtx === "string" && globalCtx) ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      "";
    if (!raw) return false;
    const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as {
      uncachedEdgeURL?: string;
    };
    return Boolean(json.uncachedEdgeURL?.trim());
  } catch {
    return false;
  }
}

/**
 * Site-wide store. Prefer strong consistency so Sync shows in /office immediately;
 * fall back to eventual when the runtime cannot do strong reads.
 */
export function getOfficeLockerStore(): Store {
  if (!storeSingleton) {
    const consistency = blobsSupportsStrongConsistency() ? "strong" : "eventual";
    if (consistency === "eventual") {
      console.warn(
        "[office-blobs] Blobs strong consistency unavailable (no uncachedEdgeURL); using eventual",
      );
    }
    storeSingleton = getStore({
      name: OFFICE_LOCKER_STORE,
      consistency,
    });
  }
  return storeSingleton;
}

export function encodePath(relativePath: string): string {
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

export function decodePath(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

export function fileMetaKey(jobId: string, relativePath: string): string {
  return `jobs/${jobId}/f/${encodePath(relativePath)}/meta.json`;
}

export function fileChunkKey(jobId: string, relativePath: string, index: number): string {
  return `jobs/${jobId}/f/${encodePath(relativePath)}/c/${index}`;
}

export function filePrefix(jobId: string, relativePath: string): string {
  return `jobs/${jobId}/f/${encodePath(relativePath)}/`;
}

export function manifestKey(jobId: string): string {
  return `jobs/${jobId}/manifest.json`;
}

export function jobPrefix(jobId: string): string {
  return `jobs/${jobId}/`;
}

export function isSafeExportJobId(jobId: string): boolean {
  const id = jobId.trim();
  if (!id || id.length > 200) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(id);
}

/**
 * Storage path under a job folder (e.g. `files/3498_2026-10-15/picture map.pdf`).
 * Must allow spaces and common filename punctuation — field exports use them.
 * Still blocks traversal, absolute paths, and control characters.
 */
export function isSafeExportRelativePath(relativePath: string): boolean {
  const p = relativePath.trim();
  if (!p || p.length > 500) return false;
  if (p.startsWith("/") || p.includes("\\") || p.includes("..")) return false;
  if (p.includes("//")) return false;
  if (/[\0-\x1f\x7f]/.test(p)) return false;
  // Reject URL schemes sneaking in as a path segment.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)) return false;
  return true;
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function utcMonthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function formatBytesPlain(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return "0 MB";
}

/** Plain-English reject messages for field Sync. */
export function plainCapMessage(
  kind: "locker" | "file" | "job" | "daily" | "chunk" | "field-key",
): string {
  switch (kind) {
    case "locker":
      return (
        "Office staging is full (about 1 GB). Photos are still on this phone.\n\n" +
        "Ask the office to Download jobs to a computer, then Delete them from staging, and try Sync again."
      );
    case "file":
      return (
        `One file is over the ${formatBytesPlain(MAX_FILE_BYTES)} limit. Photos are still on this phone.\n\n` +
        "Try a smaller photo or ask the office for help."
      );
    case "job":
      return (
        `This job is over the ${formatBytesPlain(MAX_JOB_BYTES)} per-job limit. Photos are still on this phone.\n\n` +
        "Finish a smaller job first, or ask the office to clear staging."
      );
    case "daily":
      return (
        "Today’s upload limit for office staging is used up. Photos are still on this phone.\n\n" +
        "Try Sync again tomorrow, or ask the office to check staging usage."
      );
    case "chunk":
      return "Upload piece too large. Photos are still on this phone — try Sync again.";
    case "field-key":
      return (
        "Couldn’t upload to office staging. Photos are still on this phone.\n\n" +
        "Tap Update app on the home screen, swipe this app out, and open it again. Then try Sync."
      );
    default:
      return "Couldn’t upload to office staging. Photos are still on this phone.";
  }
}

export async function listAllBlobs(prefix: string): Promise<Array<{ key: string }>> {
  const store = getOfficeLockerStore();
  const out: Array<{ key: string }> = [];
  // With paginate: true, @netlify/blobs returns an AsyncIterable of pages
  // (there is no cursor / next_cursor). Awaiting it as a single page made
  // `page.blobs` undefined and every Sync / list call fail with a 500.
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const b of page.blobs) out.push({ key: b.key });
  }
  return out;
}

export async function deleteKeys(keys: string[]): Promise<number> {
  const store = getOfficeLockerStore();
  let deleted = 0;
  for (const key of keys) {
    try {
      await store.delete(key);
      deleted++;
    } catch (e) {
      console.warn("[office-blobs] delete failed", key, e);
    }
  }
  return deleted;
}

/**
 * Delete incomplete uploads older than a few days.
 * Called from list + upload — no scheduled functions.
 */
export async function cleanupStaleIncompleteUploads(): Promise<{ deleted: number }> {
  const store = getOfficeLockerStore();
  const metas = await listAllBlobs("jobs/");
  const now = Date.now();
  let deleted = 0;

  for (const { key } of metas) {
    if (!key.endsWith("/meta.json")) continue;
    if (!key.includes("/f/")) continue;
    try {
      const meta = (await store.get(key, { type: "json" })) as FileMeta | null;
      if (!meta) continue;
      if (meta.complete) continue;
      const t = Date.parse(meta.startedAt || "");
      if (Number.isFinite(t) && now - t <= INCOMPLETE_MAX_AGE_MS) continue;
      const prefix = key.slice(0, -"meta.json".length);
      const keys = await listAllBlobs(prefix);
      deleted += await deleteKeys(keys.map((k) => k.key));
    } catch {
      /* ignore one bad meta */
    }
  }
  return { deleted };
}

async function readFileMeta(jobId: string, relativePath: string): Promise<FileMeta | null> {
  const store = getOfficeLockerStore();
  try {
    const meta = (await store.get(fileMetaKey(jobId, relativePath), {
      type: "json",
    })) as FileMeta | null;
    return meta && typeof meta === "object" ? meta : null;
  } catch {
    return null;
  }
}

export async function listJobFiles(jobId: string): Promise<JobBlobEntry[]> {
  const blobs = await listAllBlobs(`${jobPrefix(jobId)}f/`);
  const out: JobBlobEntry[] = [];
  const store = getOfficeLockerStore();
  for (const b of blobs) {
    if (!b.key.endsWith("/meta.json")) continue;
    try {
      const meta = (await store.get(b.key, { type: "json" })) as FileMeta | null;
      if (!meta?.complete || !meta.path) continue;
      out.push({
        relativePath: meta.path,
        sizeBytes: Number(meta.sizeBytes) || 0,
        contentType: meta.contentType,
        totalChunks: Number(meta.totalChunks) || 1,
      });
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function sumJobBytes(jobId: string): Promise<number> {
  const man = await readManifest(jobId);
  if (typeof man?.totalBytes === "number" && man.totalBytes > 0) return man.totalBytes;
  const files = await listJobFiles(jobId);
  return files.reduce((s, f) => s + f.sizeBytes, 0);
}

export async function sumLockerBytes(): Promise<number> {
  const blobs = await listAllBlobs("jobs/");
  const jobIds = new Set<string>();
  for (const b of blobs) {
    const parts = b.key.split("/");
    if (parts[0] === "jobs" && parts[1]) jobIds.add(parts[1]);
  }
  let total = 0;
  for (const id of jobIds) {
    total += await sumJobBytes(id);
  }
  // Incomplete (not complete) pieces still count — walk metas.
  const store = getOfficeLockerStore();
  for (const b of blobs) {
    if (!b.key.endsWith("/meta.json") || !b.key.includes("/f/")) continue;
    try {
      const meta = (await store.get(b.key, { type: "json" })) as FileMeta | null;
      if (!meta || meta.complete) continue;
      // Count received chunk bytes roughly as sizeBytes * received/total
      const recv = meta.received?.length || 0;
      const tc = meta.totalChunks || 1;
      total += Math.round(((Number(meta.sizeBytes) || 0) * recv) / tc);
    } catch {
      /* ignore */
    }
  }
  return total;
}

export async function readManifest(jobId: string): Promise<LockerManifest | null> {
  const store = getOfficeLockerStore();
  try {
    const man = (await store.get(manifestKey(jobId), { type: "json" })) as LockerManifest | null;
    return man && typeof man === "object" ? man : null;
  } catch {
    return null;
  }
}

export async function writeManifest(jobId: string, manifest: LockerManifest): Promise<void> {
  const store = getOfficeLockerStore();
  const body = JSON.stringify(manifest);
  await store.set(manifestKey(jobId), body, {
    metadata: {
      contentType: "application/json",
      sizeBytes: String(Buffer.byteLength(body)),
    },
  });
}

export async function deleteJobFolder(jobId: string): Promise<{ deleted: number }> {
  const keys = await listAllBlobs(jobPrefix(jobId));
  const deleted = await deleteKeys(keys.map((k) => k.key));
  return { deleted };
}

export async function getDailyUploadBytes(): Promise<{ day: string; bytes: number }> {
  const store = getOfficeLockerStore();
  const day = utcDayKey();
  try {
    const data = (await store.get(META_DAILY, { type: "json" })) as {
      day?: string;
      bytes?: number;
    } | null;
    if (data?.day === day) return { day, bytes: Number(data.bytes) || 0 };
  } catch {
    /* ignore */
  }
  return { day, bytes: 0 };
}

export async function addDailyUploadBytes(delta: number): Promise<number> {
  const store = getOfficeLockerStore();
  const day = utcDayKey();
  const cur = await getDailyUploadBytes();
  const bytes = (cur.day === day ? cur.bytes : 0) + Math.max(0, delta);
  await store.setJSON(META_DAILY, { day, bytes });
  return bytes;
}

export async function getDownloadMonthBytes(): Promise<{ month: string; bytes: number }> {
  const store = getOfficeLockerStore();
  const month = utcMonthKey();
  try {
    const data = (await store.get(META_DOWNLOAD_MONTH, { type: "json" })) as {
      month?: string;
      bytes?: number;
    } | null;
    if (data?.month === month) return { month, bytes: Number(data.bytes) || 0 };
  } catch {
    /* ignore */
  }
  return { month, bytes: 0 };
}

export async function addDownloadMonthBytes(delta: number): Promise<number> {
  const store = getOfficeLockerStore();
  const month = utcMonthKey();
  const cur = await getDownloadMonthBytes();
  const bytes = (cur.month === month ? cur.bytes : 0) + Math.max(0, delta);
  await store.setJSON(META_DOWNLOAD_MONTH, { month, bytes });
  return bytes;
}

export function fieldKeyConfigured(): boolean {
  return Boolean(process.env.NLF_FIELD_KEY?.trim());
}

export function verifyFieldKey(headerValue: string | null | undefined): boolean {
  const expected = process.env.NLF_FIELD_KEY?.trim();
  if (!expected) return false;
  const got = (headerValue || "").trim();
  if (!got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

export type UploadChunkResult =
  | { ok: true; complete: boolean; received: number[] }
  | { ok: false; status: number; message: string };

/**
 * Accept one raw binary chunk into chunked-at-rest storage.
 * Marks the file complete when every chunk index is present.
 */
export async function acceptUploadChunk(opts: {
  jobId: string;
  path: string;
  index: number;
  totalChunks: number;
  sizeBytes: number;
  contentType: string;
  body: ArrayBuffer;
}): Promise<UploadChunkResult> {
  const { jobId, path, index, totalChunks, sizeBytes, contentType } = opts;
  const bytes = new Uint8Array(opts.body);

  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(path)) {
    return { ok: false, status: 400, message: "That upload path looks wrong." };
  }
  if (totalChunks < 1 || totalChunks > 10_000 || index < 0 || index >= totalChunks) {
    return { ok: false, status: 400, message: "Upload piece numbers look wrong." };
  }
  if (bytes.byteLength > CHUNK_MAX_BYTES) {
    return { ok: false, status: 413, message: plainCapMessage("chunk") };
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, status: 413, message: plainCapMessage("file") };
  }

  const store = getOfficeLockerStore();
  const existing = await readFileMeta(jobId, path);
  if (existing?.complete) {
    return {
      ok: true,
      complete: true,
      received: Array.from({ length: existing.totalChunks || totalChunks }, (_, i) => i),
    };
  }

  // Cap + stale cleanup are expensive (full locker list / per-meta reads).
  // Run only on the first piece of a file so mid-file chunks stay cheap.
  // Daily / locker / job caps still apply before any bytes of a new file land.
  const isFirstPiece = index === 0 || !existing;
  if (isFirstPiece) {
    await cleanupStaleIncompleteUploads();

    const daily = await getDailyUploadBytes();
    if (daily.bytes + sizeBytes > DAILY_UPLOAD_BUDGET_BYTES) {
      // Allow resume of an in-progress file (already counted later on complete only).
      if (!existing) {
        return { ok: false, status: 429, message: plainCapMessage("daily") };
      }
    }

    const lockerUsed = await sumLockerBytes();
    if (!existing && lockerUsed + sizeBytes > LOCKER_BUDGET_BYTES) {
      return { ok: false, status: 507, message: plainCapMessage("locker") };
    }

    const jobUsed = await sumJobBytes(jobId);
    if (!existing && jobUsed + sizeBytes > MAX_JOB_BYTES) {
      return { ok: false, status: 413, message: plainCapMessage("job") };
    }
  }

  const meta: FileMeta = existing || {
    path,
    sizeBytes,
    contentType: contentType || "application/octet-stream",
    totalChunks,
    complete: false,
    startedAt: new Date().toISOString(),
    received: [],
  };
  meta.totalChunks = totalChunks;
  meta.sizeBytes = sizeBytes;
  meta.contentType = contentType || meta.contentType;

  await store.set(fileChunkKey(jobId, path, index), bytes, {
    metadata: {
      sizeBytes: String(bytes.byteLength),
      contentType: "application/octet-stream",
    },
  });

  const received = new Set<number>(meta.received || []);
  received.add(index);
  meta.received = Array.from(received).sort((a, b) => a - b);
  meta.complete = meta.received.length >= totalChunks;
  await store.setJSON(fileMetaKey(jobId, path), meta);

  if (meta.complete) {
    await addDailyUploadBytes(sizeBytes);
    // Canonical list key — also mirror manifest.json outside /f/ for fast reads.
    if (path === "manifest.json") {
      try {
        const parts: string[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const text = await store.get(fileChunkKey(jobId, path, i), { type: "text" });
          if (text == null) break;
          parts.push(text);
        }
        if (parts.length === totalChunks) {
          const parsed = JSON.parse(parts.join("")) as LockerManifest;
          await writeManifest(jobId, parsed);
        }
      } catch (e) {
        console.warn("[office-blobs] manifest mirror failed", jobId, e);
      }
    }
  }

  return { ok: true, complete: meta.complete, received: meta.received };
}

export async function getUploadFileStatus(
  jobId: string,
  path: string,
): Promise<{ complete: boolean; received: number[]; totalChunks: number | null }> {
  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(path)) {
    return { complete: false, received: [], totalChunks: null };
  }
  const meta = await readFileMeta(jobId, path);
  if (!meta) return { complete: false, received: [], totalChunks: null };
  return {
    complete: Boolean(meta.complete),
    received: meta.received || [],
    totalChunks: meta.totalChunks,
  };
}

/** Read one stored chunk by index (Download path — no whole-file load). */
export async function readStoredChunk(
  jobId: string,
  path: string,
  index: number,
): Promise<{
  bytes: Uint8Array;
  totalSize: number;
  totalChunks: number;
  contentType: string;
} | null> {
  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(path)) return null;
  if (index < 0 || index > 10_000) return null;

  const meta = await readFileMeta(jobId, path);
  if (!meta?.complete) return null;
  if (index >= meta.totalChunks) return null;

  const store = getOfficeLockerStore();
  const data = await store.get(fileChunkKey(jobId, path, index), { type: "arrayBuffer" });
  if (!data) return null;
  return {
    bytes: new Uint8Array(data),
    totalSize: Number(meta.sizeBytes) || 0,
    totalChunks: meta.totalChunks,
    contentType: meta.contentType || "application/octet-stream",
  };
}

/** Write a small complete file (manifest, pins.csv edits) as one chunk. */
export async function putCompleteSmallFile(
  jobId: string,
  path: string,
  body: string | Uint8Array,
  contentType: string,
): Promise<void> {
  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(path)) {
    throw new Error("Invalid path.");
  }
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  if (bytes.byteLength > CHUNK_MAX_BYTES) {
    throw new Error("File too large for single write.");
  }
  const store = getOfficeLockerStore();
  // Replace prior chunks if any.
  const prior = await listAllBlobs(filePrefix(jobId, path));
  await deleteKeys(prior.map((k) => k.key));

  await store.set(fileChunkKey(jobId, path, 0), bytes, {
    metadata: { sizeBytes: String(bytes.byteLength), contentType },
  });
  const meta: FileMeta = {
    path,
    sizeBytes: bytes.byteLength,
    contentType,
    totalChunks: 1,
    complete: true,
    startedAt: new Date().toISOString(),
    received: [0],
  };
  await store.setJSON(fileMetaKey(jobId, path), meta);
}

/** Read a complete small text file (manifest helper / pins). */
export async function readCompleteTextFile(
  jobId: string,
  path: string,
): Promise<string | null> {
  const meta = await readFileMeta(jobId, path);
  if (!meta?.complete) return null;
  const store = getOfficeLockerStore();
  const parts: string[] = [];
  for (let i = 0; i < meta.totalChunks; i++) {
    const data = await store.get(fileChunkKey(jobId, path, i), { type: "text" });
    if (data == null) return null;
    parts.push(data);
  }
  return parts.join("");
}

export async function listJobFolders(): Promise<
  Array<{
    id: string;
    displayName: string | null;
    fileCount: number;
    totalBytes: number;
    manifestFileCount: number | null;
    storageObjectCount: number;
    syncIncomplete: boolean;
    syncedAt: string | null;
    syncedFrom: string | null;
  }>
> {
  await cleanupStaleIncompleteUploads();
  const blobs = await listAllBlobs("jobs/");
  const jobIds = new Set<string>();
  for (const b of blobs) {
    const parts = b.key.split("/");
    if (parts[0] === "jobs" && parts[1]) jobIds.add(parts[1]);
  }

  const jobs = [];
  for (const id of jobIds) {
    const man = await readManifest(id);
    const files = await listJobFiles(id);
    // Skip jobs that only have incomplete uploads and no manifest yet.
    if (!man && files.length === 0) continue;

    const manifestFileCount = man?.files?.length ?? null;
    const storageObjectCount = files.length;
    let missing = 0;
    if (man?.files?.length) {
      const have = new Set(files.map((f) => f.relativePath));
      for (const f of man.files) {
        if (f.path && !have.has(f.path)) missing++;
      }
    }
    const totalBytes =
      typeof man?.totalBytes === "number" && man.totalBytes > 0
        ? man.totalBytes
        : files.reduce((s, f) => s + f.sizeBytes, 0);
    const syncedFrom = man?.syncedFrom?.trim() || man?.deviceName?.trim() || null;
    const syncedAtRaw = man?.syncedAt?.trim() || null;
    let syncedAt: string | null = null;
    if (syncedAtRaw) {
      const t = Date.parse(syncedAtRaw);
      syncedAt = Number.isFinite(t) ? new Date(t).toISOString() : syncedAtRaw;
    }
    jobs.push({
      id,
      displayName: man?.folderName?.trim() || null,
      fileCount: storageObjectCount,
      totalBytes,
      manifestFileCount,
      storageObjectCount,
      syncIncomplete:
        missing > 0 || (manifestFileCount != null && manifestFileCount > storageObjectCount),
      syncedAt,
      syncedFrom,
    });
  }

  jobs.sort((a, b) => {
    const aTime = a.syncedAt ? Date.parse(a.syncedAt) : 0;
    const bTime = b.syncedAt ? Date.parse(b.syncedAt) : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.displayName || a.id).localeCompare(b.displayName || b.id);
  });
  return jobs;
}
