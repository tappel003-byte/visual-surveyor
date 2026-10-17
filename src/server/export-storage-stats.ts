type StorageListItem = {
  name: string;
  id: string | null;
  metadata?: { size?: number } | null;
};

export type StoredObject = {
  /** Path relative to job folder, e.g. `files/room/photo.jpg` */
  relativePath: string;
  sizeBytes: number;
};

export type ExportManifestJson = {
  folderName?: string;
  uploadKind?: string;
  /** ISO timestamp written by field Sync / Export cloud. */
  syncedAt?: string;
  /** Device nickname from the phone that synced (`syncedFrom` preferred). */
  syncedFrom?: string;
  deviceName?: string;
  /** Total payload bytes (written by field Sync) — used by light list / capacity meter. */
  totalBytes?: number;
  files?: Array<{ path: string; zipPath: string; sizeBytes?: number }>;
};

export type JobFolderStats = {
  id: string;
  displayName: string | null;
  /** Primary count shown in the office list (manifest when present, else storage blobs). */
  fileCount: number;
  totalBytes: number;
  manifestFileCount: number | null;
  storageObjectCount: number;
  syncIncomplete: boolean;
  /** Last synced time from manifest (`syncedAt`), if present. */
  syncedAt: string | null;
  /** Whose phone synced — device nickname (`syncedFrom` / `deviceName`). */
  syncedFrom: string | null;
};

type ListBucket = {
  list: (
    path: string,
    options: { limit: number; offset?: number },
  ) => Promise<{ data: StorageListItem[] | null; error: { message: string } | null }>;
  download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
};

/** Walk every blob under `{jobId}/` (export layout uses nested `files/…` paths). */
export async function listStoredObjectsForJob(
  bucket: ListBucket,
  jobId: string,
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];

  const walk = async (relativeDir: string) => {
    let offset = 0;
    for (;;) {
      const storagePath = relativeDir ? `${jobId}/${relativeDir}` : jobId;
      const { data, error } = await bucket.list(storagePath, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      const page = data ?? [];
      if (!page.length) break;

      for (const item of page) {
        const childRel = relativeDir ? `${relativeDir}/${item.name}` : item.name;
        if (item.id === null) {
          await walk(childRel);
        } else {
          objects.push({
            relativePath: childRel,
            sizeBytes: Number(item.metadata?.size ?? 0),
          });
        }
      }

      if (page.length < 1000) break;
      offset += page.length;
    }
  };

  await walk("");
  return objects;
}

export async function loadExportManifest(
  bucket: ListBucket,
  jobId: string,
): Promise<ExportManifestJson | null> {
  const { data, error } = await bucket.download(`${jobId}/manifest.json`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as ExportManifestJson;
  } catch {
    return null;
  }
}

function displayNameFromManifest(manifest: ExportManifestJson | null): string | null {
  const name = manifest?.folderName?.trim();
  return name || null;
}

function syncedAtFromManifest(manifest: ExportManifestJson | null): string | null {
  const raw = manifest?.syncedAt?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : raw;
}

function syncedFromFromManifest(manifest: ExportManifestJson | null): string | null {
  const from = manifest?.syncedFrom?.trim() || manifest?.deviceName?.trim();
  return from || null;
}

/**
 * Fast list-row stats: read `manifest.json` only — no recursive storage walk.
 * Exact byte totals / sync-incomplete come from Open (`exports-job`) which still walks.
 */
export async function lightStatsForExportJob(
  bucket: ListBucket,
  jobId: string,
): Promise<JobFolderStats> {
  const manifest = await loadExportManifest(bucket, jobId);
  if (manifest) {
    const manifestPaths = (manifest.files ?? [])
      .map((f) => f.path?.trim())
      .filter((p): p is string => Boolean(p));
    const manifestFileCount = manifestPaths.length > 0 ? manifestPaths.length : null;
    const fileCount = manifestFileCount ?? 0;
    const declared =
      typeof manifest.totalBytes === "number" && Number.isFinite(manifest.totalBytes)
        ? Math.max(0, Math.round(manifest.totalBytes))
        : 0;
    const fromFileSizes = (manifest.files ?? []).reduce((sum, f) => {
      const n = typeof f.sizeBytes === "number" && Number.isFinite(f.sizeBytes) ? f.sizeBytes : 0;
      return sum + Math.max(0, n);
    }, 0);
    return {
      id: jobId,
      displayName: displayNameFromManifest(manifest),
      fileCount,
      /** Prefer manifest.totalBytes; else sum per-file sizeBytes — no storage walk. */
      totalBytes: declared > 0 ? declared : fromFileSizes,
      manifestFileCount,
      /** Provisional; Open/deep refresh compares real storage. */
      storageObjectCount: fileCount,
      syncIncomplete: false,
      syncedAt: syncedAtFromManifest(manifest),
      syncedFrom: syncedFromFromManifest(manifest),
    };
  }

  // Legacy / ZIP-only folders: one shallow list (no recursion).
  let fileCount = 0;
  let totalBytes = 0;
  try {
    const { data, error } = await bucket.list(jobId, { limit: 200 });
    if (!error && data) {
      for (const item of data) {
        if (item.id === null) continue; // nested folder — skip deep walk
        if (item.name === "manifest.json") continue;
        fileCount += 1;
        totalBytes += Number(item.metadata?.size ?? 0);
      }
    }
  } catch {
    /* empty */
  }

  return {
    id: jobId,
    displayName: null,
    fileCount,
    totalBytes,
    manifestFileCount: null,
    storageObjectCount: fileCount,
    syncIncomplete: false,
    syncedAt: null,
    syncedFrom: null,
  };
}

/** Full recursive stats (storage walk). Prefer lightStatsForExportJob for /exports-list. */
export async function statsForExportJob(bucket: ListBucket, jobId: string): Promise<JobFolderStats> {
  const manifest = await loadExportManifest(bucket, jobId);
  const displayName = displayNameFromManifest(manifest);

  let objects: StoredObject[] = [];
  try {
    objects = await listStoredObjectsForJob(bucket, jobId);
  } catch {
    objects = [];
  }

  const contentObjects = objects.filter((o) => o.relativePath !== "manifest.json");
  const storageObjectCount = contentObjects.length;
  const totalBytes = contentObjects.reduce((sum, o) => sum + o.sizeBytes, 0);

  const manifestPaths = (manifest?.files ?? [])
    .map((f) => f.path?.trim())
    .filter((p): p is string => Boolean(p));
  const manifestFileCount = manifestPaths.length > 0 ? manifestPaths.length : null;

  const storedPathSet = new Set(contentObjects.map((o) => o.relativePath));

  let syncIncomplete = false;
  if (manifestFileCount != null) {
    syncIncomplete =
      manifestFileCount > storageObjectCount ||
      manifestPaths.some((p) => !storedPathSet.has(p));
  }

  const fileCount = manifestFileCount ?? storageObjectCount;

  return {
    id: jobId,
    displayName,
    fileCount,
    totalBytes,
    manifestFileCount,
    storageObjectCount,
    syncIncomplete,
    syncedAt: syncedAtFromManifest(manifest),
    syncedFrom: syncedFromFromManifest(manifest),
  };
}
