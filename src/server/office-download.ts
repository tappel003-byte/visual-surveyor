const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type OfficeDownloadFile = {
  /** Human label (zip part name or zipPath from manifest). */
  label: string;
  sizeBytes: number | null;
  /** Direct HTTPS URL to Lovable/Supabase storage (time-limited). */
  signedUrl: string;
};

export type OfficeJobDownloadPayload = {
  jobId: string;
  kind: "manifest" | "zip-parts" | "empty";
  folderName: string | null;
  uploadKind: string | null;
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
  files?: Array<{ path: string; zipPath: string }>;
};

export function officeDownloadStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Reject path segments and odd characters — job ids are UUIDs or similar single folder names. */
export function isSafeExportJobId(jobId: string): boolean {
  const id = jobId.trim();
  if (!id || id.length > 200) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(id);
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

/** Builds per-file signed download URLs from Lovable exports storage (server-only). */
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
      const storagePath = `${jobId}/${path}`;
      const signedUrl = await signObject(storagePath);
      if (!signedUrl) continue;
      files.push({ label, sizeBytes: sizeByPath.get(path) ?? null, signedUrl });
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
    const storagePath = `${jobId}/${part.name}`;
    const signedUrl = await signObject(storagePath);
    if (!signedUrl) continue;
    const sizeBytes = Number(part.metadata?.size) || null;
    files.push({ label: part.name, sizeBytes, signedUrl });
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
