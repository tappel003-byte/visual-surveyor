import {
  isSafeExportJobId,
  isSafeExportRelativePath,
  listJobFiles,
  readManifest,
  type LockerManifest,
} from "@/server/office-blobs";
import { isLovableOfficeRuntime, type OfficeJobSource } from "@/server/office-host";

export { isSafeExportJobId, isSafeExportRelativePath };

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const EXPORTS_JOB_URL = "https://visual-surveyor.lovable.app/api/public/exports-job";
const EXPORTS_SIGN_URL = "https://visual-surveyor.lovable.app/api/public/exports-sign";

export type OfficeDownloadFile = {
  /** Storage path relative to the job folder (used for lazy chunk download). */
  path: string;
  /** Human label (zip part name or zipPath from manifest). */
  label: string;
  sizeBytes: number | null;
  /**
   * Direct HTTPS signed URL (Lovable locker) OR same-origin chunk marker (Blobs).
   * Null on list until sign-on-click.
   */
  signedUrl: string | null;
  totalChunks?: number;
};

export type OfficeJobDownloadPayload = {
  jobId: string;
  kind: "manifest" | "zip-parts" | "empty";
  folderName: string | null;
  uploadKind: string | null;
  syncedAt: string | null;
  syncedFrom: string | null;
  getPagePath: string;
  signedUrlTtlSeconds: number;
  files: OfficeDownloadFile[];
  manifestExpectedFiles: number | null;
  storageObjectCount: number;
  syncIncomplete: boolean;
  missingManifestPaths: number;
  /** Which locker served this job. */
  source: OfficeJobSource;
};

/** True when Blobs and/or Lovable list token / Supabase can serve downloads. */
export function officeDownloadStorageConfigured(): boolean {
  if (isLovableOfficeRuntime()) return true;
  return true;
}

function manifestSyncedAt(manifest: LockerManifest | null): string | null {
  const raw = manifest?.syncedAt?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : raw;
}

function manifestSyncedFrom(manifest: LockerManifest | null): string | null {
  return manifest?.syncedFrom?.trim() || manifest?.deviceName?.trim() || null;
}

/** Marker URL — client fetches /api/office/file-chunk with session. */
export function officeFileAccessMarker(jobId: string, relativePath: string): string {
  return (
    `/api/office/file-chunk?jobId=${encodeURIComponent(jobId)}` +
    `&path=${encodeURIComponent(relativePath)}`
  );
}

export function isBlobsChunkMarker(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/api/office/file-chunk") || url.includes("/api/office/file-chunk?");
}

/**
 * Netlify → Lovable: unsigned file list via Bearer EXPORTS_LIST_TOKEN.
 */
export async function fetchOfficeJobDownloadFromLovable(
  jobId: string,
): Promise<{ ok: true; payload: OfficeJobDownloadPayload } | { ok: false; unauthorized: boolean }> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) {
    return { ok: false, unauthorized: true };
  }

  const url = `${EXPORTS_JOB_URL}?jobId=${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    return { ok: false, unauthorized: true };
  }

  if (!res.ok) {
    throw new Error(
      `Exports job failed (${res.status}). If this is 404, publish the app once in Lovable so /api/public/exports-job is live.`,
    );
  }

  const payload = (await res.json()) as Omit<OfficeJobDownloadPayload, "source">;
  return { ok: true, payload: { ...payload, source: "lovable" } };
}

/**
 * Netlify → Lovable: mint one signed HTTPS URL.
 */
export async function fetchOfficeSignedUrlFromLovable(
  jobId: string,
  relativePath: string,
): Promise<
  { ok: true; signedUrl: string; expiresIn: number } | { ok: false; unauthorized: boolean }
> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) {
    return { ok: false, unauthorized: true };
  }

  const url =
    `${EXPORTS_SIGN_URL}?jobId=${encodeURIComponent(jobId)}` +
    `&path=${encodeURIComponent(relativePath)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    return { ok: false, unauthorized: true };
  }

  if (!res.ok) {
    throw new Error(
      `Exports sign failed (${res.status}). If this is 404, publish once in Lovable so /api/public/exports-sign is live.`,
    );
  }

  const body = (await res.json()) as { signedUrl?: string; expiresIn?: number };
  if (!body.signedUrl) {
    throw new Error("Exports sign returned no URL.");
  }
  return {
    ok: true,
    signedUrl: body.signedUrl,
    expiresIn: Number(body.expiresIn) || SIGNED_URL_TTL_SECONDS,
  };
}

async function signObject(storagePath: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");
  const { data, error } = await bucket.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[office-download] signed URL failed", storagePath, error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Lists files for Open from Netlify Blobs — no third-party signed URLs.
 */
export async function buildOfficeJobDownloadFromBlobs(
  jobId: string,
): Promise<OfficeJobDownloadPayload> {
  const base = {
    jobId,
    getPagePath: `/get?job=${encodeURIComponent(jobId)}`,
    signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
    files: [] as OfficeDownloadFile[],
    manifestExpectedFiles: null as number | null,
    storageObjectCount: 0,
    syncIncomplete: false,
    missingManifestPaths: 0,
    syncedAt: null as string | null,
    syncedFrom: null as string | null,
    source: "blobs" as const,
  };

  if (!isSafeExportJobId(jobId)) {
    return { ...base, kind: "empty", folderName: null, uploadKind: null };
  }

  const stored = await listJobFiles(jobId);
  const storedPathSet = new Set(stored.map((o) => o.relativePath));
  const sizeByPath = new Map(stored.map((o) => [o.relativePath, o.sizeBytes]));
  const chunksByPath = new Map(stored.map((o) => [o.relativePath, o.totalChunks]));
  base.storageObjectCount = stored.length;

  const manifest = await readManifest(jobId);
  base.syncedAt = manifestSyncedAt(manifest);
  base.syncedFrom = manifestSyncedFrom(manifest);

  if (manifest?.files?.length) {
    const folderName = manifest.folderName?.trim() || null;
    const uploadKind = manifest.uploadKind?.trim() || null;
    const files: OfficeDownloadFile[] = [];
    let missingManifestPaths = 0;
    for (const entry of manifest.files) {
      const path = entry.path?.trim();
      const label = entry.zipPath?.trim() || path;
      if (!path || !label) continue;
      if (!storedPathSet.has(path)) {
        missingManifestPaths++;
        continue;
      }
      files.push({
        path,
        label,
        sizeBytes: sizeByPath.get(path) ?? null,
        signedUrl: null,
        totalChunks: chunksByPath.get(path) ?? 1,
      });
    }
    files.sort((a, b) => a.label.localeCompare(b.label));
    const manifestExpectedFiles = manifest.files.length;
    const syncIncomplete = missingManifestPaths > 0 || manifestExpectedFiles > stored.length;
    return {
      ...base,
      kind: files.length ? "manifest" : "empty",
      folderName,
      uploadKind,
      files,
      manifestExpectedFiles,
      syncIncomplete,
      missingManifestPaths,
    };
  }

  const files: OfficeDownloadFile[] = stored
    .filter((o) => o.relativePath !== "manifest.json")
    .map((o) => ({
      path: o.relativePath,
      label: o.relativePath.replace(/^files\//, ""),
      sizeBytes: o.sizeBytes,
      signedUrl: null,
      totalChunks: o.totalChunks,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    ...base,
    kind: files.length ? "manifest" : "empty",
    folderName: null,
    uploadKind: null,
    files,
    manifestExpectedFiles: null,
    syncIncomplete: false,
    missingManifestPaths: 0,
  };
}

/**
 * Lovable runtime: list from Supabase with service role (same as pre-cutover).
 */
export async function buildOfficeJobDownloadFromSupabase(
  jobId: string,
): Promise<OfficeJobDownloadPayload> {
  const base = {
    jobId,
    getPagePath: `/get?job=${encodeURIComponent(jobId)}`,
    signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
    files: [] as OfficeDownloadFile[],
    manifestExpectedFiles: null as number | null,
    storageObjectCount: 0,
    syncIncomplete: false,
    missingManifestPaths: 0,
    syncedAt: null as string | null,
    syncedFrom: null as string | null,
    source: "lovable" as const,
  };

  if (!isSafeExportJobId(jobId)) {
    return { ...base, kind: "empty", folderName: null, uploadKind: null };
  }

  const { listStoredObjectsForJob } = await import("@/server/export-storage-stats");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");

  let contentObjects: Awaited<ReturnType<typeof listStoredObjectsForJob>> = [];
  try {
    contentObjects = await listStoredObjectsForJob(bucket, jobId);
  } catch (e) {
    console.error("[office-download] list failed", jobId, e);
    return { ...base, kind: "empty", folderName: null, uploadKind: null };
  }

  const storedPathSet = new Set(contentObjects.map((o) => o.relativePath));
  const sizeByPath = new Map(contentObjects.map((o) => [o.relativePath, o.sizeBytes]));
  base.storageObjectCount = contentObjects.length;

  type ManifestJson = {
    folderName?: string;
    uploadKind?: string;
    syncedAt?: string;
    syncedFrom?: string;
    deviceName?: string;
    files?: Array<{ path: string; zipPath: string }>;
  };

  let manifest: ManifestJson | null = null;
  const { data: manData } = await bucket.download(`${jobId}/manifest.json`);
  if (manData) {
    try {
      manifest = JSON.parse(await manData.text()) as ManifestJson;
    } catch {
      manifest = null;
    }
  }

  const rawSynced = manifest?.syncedAt?.trim();
  if (rawSynced) {
    const t = Date.parse(rawSynced);
    base.syncedAt = Number.isFinite(t) ? new Date(t).toISOString() : rawSynced;
  }
  base.syncedFrom = manifest?.syncedFrom?.trim() || manifest?.deviceName?.trim() || null;

  if (manifest?.files?.length) {
    const folderName = manifest.folderName?.trim() || null;
    const uploadKind = manifest.uploadKind?.trim() || null;
    const files: OfficeDownloadFile[] = [];
    let missingManifestPaths = 0;
    for (const entry of manifest.files) {
      const path = entry.path?.trim();
      const label = entry.zipPath?.trim() || path;
      if (!path || !label) continue;
      if (!storedPathSet.has(path)) {
        missingManifestPaths++;
        continue;
      }
      files.push({
        path,
        label,
        sizeBytes: sizeByPath.get(path) ?? null,
        signedUrl: null,
        totalChunks: 1,
      });
    }
    files.sort((a, b) => a.label.localeCompare(b.label));
    const manifestExpectedFiles = manifest.files.length;
    const syncIncomplete =
      missingManifestPaths > 0 || manifestExpectedFiles > contentObjects.length;
    return {
      ...base,
      kind: files.length ? "manifest" : "empty",
      folderName,
      uploadKind,
      files,
      manifestExpectedFiles,
      syncIncomplete,
      missingManifestPaths,
    };
  }

  const { data, error } = await bucket.list(jobId, { limit: 200 });
  if (error) {
    console.error("[office-download] list failed", jobId, error.message);
    return { ...base, kind: "empty", folderName: null, uploadKind: null };
  }

  const zips = (data || [])
    .filter((f) => f.name.endsWith(".zip"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files: OfficeDownloadFile[] = zips.map((part) => ({
    path: part.name,
    label: part.name,
    sizeBytes: Number(part.metadata?.size) || null,
    signedUrl: null,
    totalChunks: 1,
  }));

  return {
    ...base,
    kind: files.length ? "zip-parts" : "empty",
    folderName: null,
    uploadKind: null,
    files,
    manifestExpectedFiles: null,
    syncIncomplete: false,
    missingManifestPaths: 0,
  };
}

/** @deprecated Prefer buildOfficeJobDownloadFromBlobs / resolveOfficeJobDownload. */
export async function buildOfficeJobDownload(jobId: string): Promise<OfficeJobDownloadPayload> {
  return resolveOfficeJobDownload(jobId);
}

/**
 * Open/Download payload — host-local locker only.
 * Lovable → Supabase. www → Blobs only (never pull old Lovable jobs onto www).
 */
export async function resolveOfficeJobDownload(
  jobId: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<OfficeJobDownloadPayload> {
  if (isLovableOfficeRuntime()) {
    return buildOfficeJobDownloadFromSupabase(jobId);
  }

  try {
    return await buildOfficeJobDownloadFromBlobs(jobId);
  } catch (e) {
    console.error("[office-download] blobs resolve failed", jobId, e);
    return emptyPayload(jobId, "blobs");
  }
}

function emptyPayload(jobId: string, source: OfficeJobSource): OfficeJobDownloadPayload {
  return {
    jobId,
    kind: "empty",
    folderName: null,
    uploadKind: null,
    syncedAt: null,
    syncedFrom: null,
    getPagePath: `/get?job=${encodeURIComponent(jobId)}`,
    signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
    files: [],
    manifestExpectedFiles: null,
    storageObjectCount: 0,
    syncIncomplete: false,
    missingManifestPaths: 0,
    source,
  };
}

export type OfficeSignResult = {
  signedUrl: string;
  expiresIn: number;
  totalChunks: number;
  sizeBytes: number;
  /** "chunk" = same-origin Blobs pieces; "signed" = HTTPS Lovable storage URL. */
  access: "chunk" | "signed";
  source: OfficeJobSource;
};

/**
 * Desk “sign”: host-local only.
 * Lovable → HTTPS signed storage URL (spaces OK, e.g. picture map.pdf).
 * www → Blobs chunk marker (same-origin pieces).
 */
export async function signOfficeExportFile(
  jobId: string,
  relativePath: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<OfficeSignResult | null> {
  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(relativePath)) return null;
  if (relativePath === "manifest.json") return null;

  if (isLovableOfficeRuntime()) {
    const signedUrl = await signObject(`${jobId}/${relativePath}`);
    if (!signedUrl) return null;
    return {
      signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      totalChunks: 1,
      sizeBytes: 0,
      access: "signed",
      source: "lovable",
    };
  }

  try {
    const files = await listJobFiles(jobId);
    const hit = files.find((f) => f.relativePath === relativePath);
    if (!hit) return null;
    return {
      signedUrl: officeFileAccessMarker(jobId, relativePath),
      expiresIn: SIGNED_URL_TTL_SECONDS,
      totalChunks: hit.totalChunks,
      sizeBytes: hit.sizeBytes,
      access: "chunk",
      source: "blobs",
    };
  } catch {
    return null;
  }
}
