import { statsForExportJob } from "@/server/export-storage-stats";
import { officeDownloadStorageConfigured } from "@/server/office-download";

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

/** Lists job folders from Supabase `exports` storage (Netlify server-only). */
export async function fetchExportJobList(): Promise<
  { ok: true; jobs: OfficeJobFolder[] } | { ok: false; missingServiceRole: boolean }
> {
  if (!officeDownloadStorageConfigured()) {
    return { ok: false, missingServiceRole: true };
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
