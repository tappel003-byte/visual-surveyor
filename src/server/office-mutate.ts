import {
  isSafeExportJobId,
  officeDownloadStorageConfigured,
} from "@/server/office-download";

const EXPORTS_DELETE_URL = "https://visual-surveyor.lovable.app/api/public/exports-delete";
const EXPORTS_FROM_URL = "https://visual-surveyor.lovable.app/api/public/exports-from";

type ManifestJson = {
  version?: number;
  folderName?: string;
  uploadKind?: string;
  syncedAt?: string;
  syncedFrom?: string;
  deviceName?: string;
  files?: Array<{ path: string; zipPath: string }>;
  createdAt?: string;
};

/** Delete every object under exports/<jobId>/ (Lovable / service role). */
export async function deleteExportJobFolder(jobId: string): Promise<{ deleted: number }> {
  if (!officeDownloadStorageConfigured()) {
    throw new Error("Storage not configured.");
  }
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }

  const { listStoredObjectsForJob } = await import("@/server/export-storage-stats");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");

  let objects: Awaited<ReturnType<typeof listStoredObjectsForJob>> = [];
  try {
    objects = await listStoredObjectsForJob(bucket, jobId);
  } catch (e) {
    console.error("[office-mutate] list for delete failed", jobId, e);
    throw new Error("Could not list job files for delete.");
  }

  const paths = objects.map((o) => `${jobId}/${o.relativePath}`);
  if (!paths.length) {
    // Still try removing a lone manifest if list returned empty but folder exists.
    const { error } = await bucket.remove([`${jobId}/manifest.json`]);
    if (error) {
      console.warn("[office-mutate] empty-job remove", error.message);
    }
    return { deleted: 0 };
  }

  let deleted = 0;
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { data, error } = await bucket.remove(chunk);
    if (error) {
      console.error("[office-mutate] remove failed", jobId, error.message);
      throw new Error(`Delete failed: ${error.message}`);
    }
    deleted += data?.length ?? chunk.length;
  }

  return { deleted };
}

/** Update or create manifest syncedFrom / deviceName for office From column. */
export async function updateExportJobFrom(
  jobId: string,
  syncedFrom: string,
): Promise<{ syncedFrom: string }> {
  if (!officeDownloadStorageConfigured()) {
    throw new Error("Storage not configured.");
  }
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  const label = syncedFrom.trim().slice(0, 80);
  if (!label) {
    throw new Error("From label required.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");
  const manifestPath = `${jobId}/manifest.json`;

  let manifest: ManifestJson = {
    version: 1,
    folderName: jobId,
    files: [],
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await bucket.download(manifestPath);
  if (!error && data) {
    try {
      const parsed = JSON.parse(await data.text()) as ManifestJson;
      if (parsed && typeof parsed === "object") {
        manifest = parsed;
      }
    } catch {
      /* keep default shell */
    }
  }

  manifest.syncedFrom = label;
  manifest.deviceName = label;
  if (!manifest.version) manifest.version = 1;

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const { error: upErr } = await bucket.upload(manifestPath, blob, {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) {
    console.error("[office-mutate] manifest upload failed", jobId, upErr.message);
    throw new Error(`Could not save From: ${upErr.message}`);
  }

  return { syncedFrom: label };
}

/** Netlify → Lovable delete. */
export async function fetchDeleteExportJobFromLovable(
  jobId: string,
): Promise<{ ok: true; deleted: number } | { ok: false; unauthorized: boolean }> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) return { ok: false, unauthorized: true };

  const url = `${EXPORTS_DELETE_URL}?jobId=${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok) {
    throw new Error(
      `Exports delete failed (${res.status}). Publish once in Lovable so /api/public/exports-delete is live.`,
    );
  }
  const body = (await res.json()) as { deleted?: number };
  return { ok: true, deleted: Number(body.deleted) || 0 };
}

/** Netlify → Lovable From write-back. */
export async function fetchSetExportFromFromLovable(
  jobId: string,
  syncedFrom: string,
): Promise<{ ok: true; syncedFrom: string } | { ok: false; unauthorized: boolean }> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) return { ok: false, unauthorized: true };

  const res = await fetch(EXPORTS_FROM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId, syncedFrom }),
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok) {
    throw new Error(
      `Exports from update failed (${res.status}). Publish once in Lovable so /api/public/exports-from is live.`,
    );
  }
  const body = (await res.json()) as { syncedFrom?: string };
  return { ok: true, syncedFrom: body.syncedFrom?.trim() || syncedFrom.trim() };
}
