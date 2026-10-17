const SIGNED_URL_TTL_SECONDS = 60 * 60;
const EXPORTS_JOB_URL = "https://visual-surveyor.lovable.app/api/public/exports-job";
const EXPORTS_SIGN_URL = "https://visual-surveyor.lovable.app/api/public/exports-sign";

export type OfficeDownloadFile = {
  /** Storage path relative to the job folder (used for lazy sign). */
  path: string;
  /** Human label (zip part name or zipPath from manifest). */
  label: string;
  sizeBytes: number | null;
  /**
   * Direct HTTPS URL — only present when a single file was signed on demand.
   * Open list responses leave this null so large jobs load quickly.
   */
  signedUrl: string | null;
};

export type OfficeJobDownloadPayload = {
  jobId: string;
  kind: "manifest" | "zip-parts" | "empty";
  folderName: string | null;
  uploadKind: string | null;
  syncedAt: string | null;
  syncedFrom: string | null;
  /** Same path as legacy Export link — browser downloads from storage, not Netlify. */
  getPagePath: string;
  signedUrlTtlSeconds: number;
  files: OfficeDownloadFile[];
  manifestExpectedFiles: number | null;
  storageObjectCount: number;
  syncIncomplete: boolean;
  missingManifestPaths: number;
};

type ManifestJson = {
  folderName?: string;
  uploadKind?: string;
  syncedAt?: string;
  syncedFrom?: string;
  deviceName?: string;
  files?: Array<{ path: string; zipPath: string }>;
};

/** True when Lovable can mint signed URLs (service role present on that host). */
export function officeDownloadStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Netlify office Open: fetch unsigned file list from Lovable (Bearer EXPORTS_LIST_TOKEN).
 * Never requires SUPABASE_SERVICE_ROLE_KEY on Netlify.
 */
export async function fetchOfficeJobDownloadFromLovable(jobId: string): Promise<
  | { ok: true; payload: OfficeJobDownloadPayload }
  | { ok: false; unauthorized: boolean }
> {
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

  const payload = (await res.json()) as OfficeJobDownloadPayload;
  return { ok: true, payload };
}

/**
 * Netlify: mint one signed URL via Lovable when the user clicks a file.
 */
export async function fetchOfficeSignedUrlFromLovable(
  jobId: string,
  relativePath: string,
): Promise<{ ok: true; signedUrl: string; expiresIn: number } | { ok: false; unauthorized: boolean }> {
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

/** Reject path segments and odd characters — job ids are UUIDs or similar single folder names. */
export function isSafeExportJobId(jobId: string): boolean {
  const id = jobId.trim();
  if (!id || id.length > 200) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(id);
}

/** Safe relative storage path under a job (no traversal). */
export function isSafeExportRelativePath(relativePath: string): boolean {
  const p = relativePath.trim();
  if (!p || p.length > 500) return false;
  if (p.startsWith("/") || p.includes("\\") || p.includes("..")) return false;
  if (p.includes("//")) return false;
  return /^[a-zA-Z0-9._/-]+$/.test(p);
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

async function loadManifest(jobId: string): Promise<ManifestJson | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("exports").download(`${jobId}/manifest.json`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as ManifestJson;
  } catch {
    return null;
  }
}

function manifestSyncedAt(manifest: ManifestJson | null): string | null {
  const raw = manifest?.syncedAt?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : raw;
}

function manifestSyncedFrom(manifest: ManifestJson | null): string | null {
  return manifest?.syncedFrom?.trim() || manifest?.deviceName?.trim() || null;
}

/**
 * Lists files for Open — does NOT mint signed URLs (lazy sign on click via signOfficeExportFile).
 * Runs on Lovable with service role for storage listing only.
 */
export async function buildOfficeJobDownload(jobId: string): Promise<OfficeJobDownloadPayload> {
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
  };

  if (!officeDownloadStorageConfigured()) {
    return { ...base, kind: "empty", folderName: null, uploadKind: null };
  }

  const { listStoredObjectsForJob } = await import("@/server/export-storage-stats");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");
  let storedObjects: Awaited<ReturnType<typeof listStoredObjectsForJob>> = [];
  try {
    storedObjects = await listStoredObjectsForJob(bucket, jobId);
  } catch (e) {
    console.error("[office-download] storage walk failed", jobId, e);
  }
  const contentObjects = storedObjects.filter((o) => o.relativePath !== "manifest.json");
  const storedPathSet = new Set(contentObjects.map((o) => o.relativePath));
  const sizeByPath = new Map(contentObjects.map((o) => [o.relativePath, o.sizeBytes]));
  base.storageObjectCount = contentObjects.length;

  const manifest = await loadManifest(jobId);
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
      });
    }
    files.sort((a, b) => a.label.localeCompare(b.label));
    const manifestExpectedFiles = manifest.files.length;
    const syncIncomplete = missingManifestPaths > 0 || manifestExpectedFiles > contentObjects.length;
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

  const files: OfficeDownloadFile[] = [];
  for (const part of zips) {
    files.push({
      path: part.name,
      label: part.name,
      sizeBytes: Number(part.metadata?.size) || null,
      signedUrl: null,
    });
  }

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

/** Mint one time-limited signed URL for a file under the job (Lovable / service role). */
export async function signOfficeExportFile(
  jobId: string,
  relativePath: string,
): Promise<{ signedUrl: string; expiresIn: number } | null> {
  if (!officeDownloadStorageConfigured()) return null;
  if (!isSafeExportJobId(jobId) || !isSafeExportRelativePath(relativePath)) return null;
  if (relativePath === "manifest.json") return null;

  const storagePath = `${jobId}/${relativePath}`;
  const signedUrl = await signObject(storagePath);
  if (!signedUrl) return null;
  return { signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
}
