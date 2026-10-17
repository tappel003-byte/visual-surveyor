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
  files?: Array<{ path: string; zipPath: string }>;
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

/** Stats for one top-level exports bucket folder (job id). */
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

  const manifestPathSet = new Set(manifestPaths);
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
