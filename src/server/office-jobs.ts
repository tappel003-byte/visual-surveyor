import {
  exportsListTokenConfigured,
  isLovableOfficeRuntime,
  type OfficeJobSource,
} from "@/server/office-host";
import {
  getDownloadMonthBytes,
  listJobFolders,
  LOCKER_BUDGET_BYTES,
  sumLockerBytes,
} from "@/server/office-blobs";

const EXPORTS_LIST_URL = "https://visual-surveyor.lovable.app/api/public/exports-list";

export type OfficeJobFolder = {
  /** Top-level folder name (job id used by /office File Explorer). */
  id: string;
  /** Human-readable site / project name from export manifest (`folderName`). */
  displayName: string | null;
  fileCount: number;
  totalBytes: number;
  manifestFileCount: number | null;
  storageObjectCount: number;
  syncIncomplete: boolean;
  /** Last synced (`manifest.syncedAt`), ISO string when present. */
  syncedAt: string | null;
  /** Device nickname from Sync (`syncedFrom` / `deviceName`). */
  syncedFrom: string | null;
  /** Which locker holds this job — drives Open / Download / Delete routing. */
  source?: OfficeJobSource;
};

export type OfficeLockerStats = {
  usedBytes: number;
  budgetBytes: number;
  downloadedMonthBytes: number;
  downloadedMonthKey: string;
};

export { exportsListTokenConfigured };

/** www always has Blobs; Lovable uses Supabase. */
export function officeLockerConfigured(): boolean {
  if (isLovableOfficeRuntime()) return true;
  return true;
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
    syncedAt?: string | null;
    syncedFrom?: string | null;
  }>;
};

function sortJobs(jobs: OfficeJobFolder[]): void {
  jobs.sort((a, b) => {
    const aTime = a.syncedAt ? Date.parse(a.syncedAt) : 0;
    const bTime = b.syncedAt ? Date.parse(b.syncedAt) : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.displayName || a.id).localeCompare(b.displayName || b.id);
  });
}

function mapLovableJobs(items: NonNullable<ExportsListResponse["jobs"]>): OfficeJobFolder[] {
  const jobs: OfficeJobFolder[] = [];
  for (const item of items) {
    const id = item.id?.trim();
    if (!id) continue;
    const displayName =
      typeof item.displayName === "string" && item.displayName.trim()
        ? item.displayName.trim()
        : null;
    const manifestFileCount =
      typeof item.manifestFileCount === "number" ? item.manifestFileCount : null;
    const storageObjectCount = Number(item.storageObjectCount) || 0;
    const syncedAt =
      typeof item.syncedAt === "string" && item.syncedAt.trim() ? item.syncedAt.trim() : null;
    const syncedFrom =
      typeof item.syncedFrom === "string" && item.syncedFrom.trim() ? item.syncedFrom.trim() : null;
    jobs.push({
      id,
      displayName,
      fileCount: Number(item.fileCount) || 0,
      totalBytes: Number(item.totalBytes) || 0,
      manifestFileCount,
      storageObjectCount,
      syncIncomplete: Boolean(item.syncIncomplete),
      syncedAt,
      syncedFrom,
      source: "lovable",
    });
  }
  return jobs;
}

/** Lovable host: list exports bucket directly (no Bearer round-trip). */
export async function fetchExportJobListFromSupabase(): Promise<{
  ok: true;
  jobs: OfficeJobFolder[];
}> {
  const { lightStatsForExportJob } = await import("@/server/export-storage-stats");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");
  const { data: top, error } = await bucket.list("", { limit: 1000 });
  if (error) {
    throw new Error(`Exports list failed: ${error.message}`);
  }

  const folders = (top || []).filter((item) => item.id === null && item.name?.trim());
  const jobs = await Promise.all(
    folders.map(async (item) => {
      const stats = await lightStatsForExportJob(bucket, item.name);
      return {
        id: stats.id,
        displayName: stats.displayName,
        fileCount: stats.fileCount,
        totalBytes: stats.totalBytes,
        manifestFileCount: stats.manifestFileCount,
        storageObjectCount: stats.storageObjectCount,
        syncIncomplete: stats.syncIncomplete,
        syncedAt: stats.syncedAt,
        syncedFrom: stats.syncedFrom,
        source: "lovable" as const,
      };
    }),
  );
  sortJobs(jobs);
  return { ok: true, jobs };
}

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
  const jobs = mapLovableJobs(body.jobs ?? []);
  sortJobs(jobs);
  return { ok: true, jobs };
}

/** Lists job folders from the site-wide Netlify Blobs locker. */
export async function fetchExportJobListFromBlobs(): Promise<{
  ok: true;
  jobs: OfficeJobFolder[];
  locker: OfficeLockerStats;
}> {
  const raw = await listJobFolders();
  const jobs: OfficeJobFolder[] = (raw as Array<Omit<OfficeJobFolder, "source">>).map((j) => ({
    ...j,
    source: "blobs" as const,
  }));
  sortJobs(jobs);
  const usedBytes = await sumLockerBytes();
  const dl = await getDownloadMonthBytes();
  return {
    ok: true,
    jobs,
    locker: {
      usedBytes,
      budgetBytes: LOCKER_BUDGET_BYTES,
      downloadedMonthBytes: dl.bytes,
      downloadedMonthKey: dl.month,
    },
  };
}

/**
 * Host-split list (Tim 2026-10-19):
 * - Lovable runtime → Supabase locker only (old jobs through 16 Dec 2026).
 * - Netlify www → Netlify Blobs only. Empty is correct until a phone Syncs new work.
 *   Do NOT merge old Lovable jobs onto www.
 */
export async function fetchMergedOfficeJobList(): Promise<{
  listAvailable: boolean;
  jobs: OfficeJobFolder[];
  locker: OfficeLockerStats | null;
}> {
  if (isLovableOfficeRuntime()) {
    try {
      const result = await fetchExportJobListFromSupabase();
      const usedBytes = result.jobs.reduce((sum, j) => sum + (Number(j.totalBytes) || 0), 0);
      return {
        listAvailable: true,
        jobs: result.jobs,
        locker: {
          usedBytes,
          budgetBytes: LOCKER_BUDGET_BYTES,
          downloadedMonthBytes: 0,
          downloadedMonthKey: "",
        },
      };
    } catch (e) {
      console.error("[officeListJobs] supabase list failed", e);
      return { listAvailable: false, jobs: [], locker: null };
    }
  }

  try {
    const blobs = await fetchExportJobListFromBlobs();
    return { listAvailable: true, jobs: blobs.jobs, locker: blobs.locker };
  } catch (e) {
    console.error("[officeListJobs] blobs list failed", e);
    return { listAvailable: false, jobs: [], locker: null };
  }
}
