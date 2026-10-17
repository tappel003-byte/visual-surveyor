const EXPORTS_LIST_URL = "https://visual-surveyor.lovable.app/api/public/exports-list";

export type OfficeJobFolder = {
  /** Top-level folder name (same id used by `/get?job=`). */
  id: string;
  /** Human-readable site / project name from export manifest (`folderName`). */
  displayName: string | null;
  fileCount: number;
  totalBytes: number;
  manifestFileCount: number | null;
  storageObjectCount: number;
  syncIncomplete: boolean;
};

export function exportsListTokenConfigured(): boolean {
  return Boolean(process.env.EXPORTS_LIST_TOKEN?.trim());
}

type ExportsListResponse = {
  jobs?: Array<{
    id: string;
    displayName?: string | null;
    fileCount: number;
    totalBytes: number;
    manifestFileCount?: number | null;
    storageObjectCount?: number;
    syncIncomplete?: boolean;
  }>;
};

/** Fetches job folders from the Lovable public exports-list API (Netlify server-only). */
export async function fetchExportJobListFromLovable(): Promise<
  { ok: true; jobs: OfficeJobFolder[] } | { ok: false; unauthorized: boolean }
> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) {
    return { ok: false, unauthorized: true };
  }

  const res = await fetch(EXPORTS_LIST_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    return { ok: false, unauthorized: true };
  }

  if (!res.ok) {
    throw new Error(`Exports list failed (${res.status}).`);
  }

  const body = (await res.json()) as ExportsListResponse;
  const jobs: OfficeJobFolder[] = [];
  for (const item of body.jobs ?? []) {
    const id = item.id?.trim();
    if (!id) continue;
    const displayName =
      typeof item.displayName === "string" && item.displayName.trim() ? item.displayName.trim() : null;
    const manifestFileCount =
      typeof item.manifestFileCount === "number" ? item.manifestFileCount : null;
    const storageObjectCount = Number(item.storageObjectCount) || 0;
    jobs.push({
      id,
      displayName,
      fileCount: Number(item.fileCount) || 0,
      totalBytes: Number(item.totalBytes) || 0,
      manifestFileCount,
      storageObjectCount,
      syncIncomplete: Boolean(item.syncIncomplete),
    });
  }

  jobs.sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id));
  return { ok: true, jobs };
}
