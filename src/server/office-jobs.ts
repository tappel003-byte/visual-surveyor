import { statsForExportJob } from "@/server/export-storage-stats";
import { officeDownloadStorageConfigured } from "@/server/office-download";

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

function normalizeJobRow(item: ExportsListResponse["jobs"]![number]): OfficeJobFolder | null {
  const id = item.id?.trim();
  if (!id) return null;
  const displayName =
    typeof item.displayName === "string" && item.displayName.trim() ? item.displayName.trim() : null;
  const manifestFileCount =
    item.manifestFileCount != null && Number.isFinite(item.manifestFileCount)
      ? Number(item.manifestFileCount)
      : null;
  const storageObjectCount = Number(item.storageObjectCount) || 0;
  return {
    id,
    displayName,
    fileCount: Number(item.fileCount) || 0,
    totalBytes: Number(item.totalBytes) || 0,
    manifestFileCount,
    storageObjectCount,
    syncIncomplete: Boolean(item.syncIncomplete),
  };
}

/** Lists job folders from Supabase exports storage (preferred on Netlify when service role is set). */
export async function fetchExportJobListFromStorage(): Promise<
  { ok: true; jobs: OfficeJobFolder[] } | { ok: false; unauthorized: boolean }
> {
  if (!officeDownloadStorageConfigured()) {
    return { ok: false, unauthorized: true };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");
  const { data: top, error } = await bucket.list("", { limit: 1000 });
  if (error) {
    throw new Error(`Exports list failed: ${error.message}`);
  }

  const jobs: OfficeJobFolder[] = [];
  for (const item of top ?? []) {
    const stats = await statsForExportJob(bucket, item.name);
    jobs.push({
      id: stats.id,
      displayName: stats.displayName,
      fileCount: stats.fileCount,
      totalBytes: stats.totalBytes,
      manifestFileCount: stats.manifestFileCount,
      storageObjectCount: stats.storageObjectCount,
      syncIncomplete: stats.syncIncomplete,
    });
  }

  jobs.sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id));
  return { ok: true, jobs };
}

/** Fetches job folders from the Lovable public exports-list API (server-only). */
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
    const row = normalizeJobRow(item);
    if (row) jobs.push(row);
  }

  return { ok: true, jobs };
}

/** Prefer direct storage listing on Netlify; fall back to Lovable exports-list API. */
export async function fetchExportJobList(): Promise<
  { ok: true; jobs: OfficeJobFolder[] } | { ok: false; unauthorized: boolean }
> {
  if (officeDownloadStorageConfigured()) {
    return fetchExportJobListFromStorage();
  }
  return fetchExportJobListFromLovable();
}
