import {
  getDownloadMonthBytes,
  listJobFolders,
  LOCKER_BUDGET_BYTES,
  sumLockerBytes,
} from "@/server/office-blobs";

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
};

export type OfficeLockerStats = {
  usedBytes: number;
  budgetBytes: number;
  downloadedMonthBytes: number;
  downloadedMonthKey: string;
};

/** Blobs locker is always the www source of truth after cutover (no Lovable token). */
export function officeLockerConfigured(): boolean {
  return true;
}

/** @deprecated Use officeLockerConfigured — kept so old call sites compile during edit. */
export function exportsListTokenConfigured(): boolean {
  return officeLockerConfigured();
}

/** Lists job folders from the site-wide Netlify Blobs locker. */
export async function fetchExportJobListFromBlobs(): Promise<{
  ok: true;
  jobs: OfficeJobFolder[];
  locker: OfficeLockerStats;
}> {
  const jobs = (await listJobFolders()) as OfficeJobFolder[];
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
