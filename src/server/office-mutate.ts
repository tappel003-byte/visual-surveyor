import {
  deleteJobFolder,
  isSafeExportJobId,
  readManifest,
  writeManifest,
  type LockerManifest,
} from "@/server/office-blobs";
import { isLovableOfficeRuntime, type OfficeJobSource } from "@/server/office-host";
import type { OfficePinsPayload, PinDescriptionUpdate } from "@/lib/office-pins";
import {
  readExportJobPins as readBlobsPins,
  updateExportJobPinDescriptions as updateBlobsPins,
} from "@/server/office-pins";

const EXPORTS_DELETE_URL = "https://visual-surveyor.lovable.app/api/public/exports-delete";
const EXPORTS_FROM_URL = "https://visual-surveyor.lovable.app/api/public/exports-from";
const EXPORTS_NAME_URL = "https://visual-surveyor.lovable.app/api/public/exports-name";
const EXPORTS_PINS_URL = "https://visual-surveyor.lovable.app/api/public/exports-pins";

/** Human-facing job label for office list / header (keeps spaces; strips path-illegal chars). */
export function sanitizeOfficeFolderName(raw: string): string {
  return raw
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

/** Delete every object under the Blobs job folder. */
export async function deleteExportJobFolderBlobs(jobId: string): Promise<{ deleted: number }> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  return deleteJobFolder(jobId);
}

/** Delete every object under exports/<jobId>/ (Lovable / service role). */
export async function deleteExportJobFolderSupabase(jobId: string): Promise<{ deleted: number }> {
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

/** Update Blobs manifest syncedFrom. */
export async function updateExportJobFromBlobs(
  jobId: string,
  syncedFrom: string,
): Promise<{ syncedFrom: string }> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  const label = syncedFrom.trim().slice(0, 80);
  if (!label) {
    throw new Error("From label required.");
  }

  const manifest: LockerManifest = (await readManifest(jobId)) || {
    version: 1,
    folderName: jobId,
    files: [],
    createdAt: new Date().toISOString(),
  };

  manifest.syncedFrom = label;
  manifest.deviceName = label;
  if (!manifest.version) manifest.version = 1;
  await writeManifest(jobId, manifest);
  return { syncedFrom: label };
}

/** Update Blobs manifest folderName. */
export async function updateExportJobFolderNameBlobs(
  jobId: string,
  folderName: string,
): Promise<{ folderName: string; officeNameEditedAt: string }> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  const label = sanitizeOfficeFolderName(folderName);
  if (!label) {
    throw new Error("Job name required.");
  }

  const manifest: LockerManifest = (await readManifest(jobId)) || {
    version: 1,
    folderName: jobId,
    files: [],
    createdAt: new Date().toISOString(),
  };

  const nowIso = new Date().toISOString();
  manifest.folderName = label;
  manifest.officeNameEditedAt = nowIso;
  if (!manifest.version) manifest.version = 1;
  await writeManifest(jobId, manifest);
  return { folderName: label, officeNameEditedAt: nowIso };
}

/** Netlify → Lovable delete API. */
export async function fetchDeleteExportJobViaLovableApi(
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
export async function fetchSetExportFromViaLovableApi(
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

/** Netlify → Lovable job display-name write-back. */
export async function fetchSetExportNameViaLovableApi(
  jobId: string,
  folderName: string,
): Promise<
  | { ok: true; folderName: string; officeNameEditedAt: string | null }
  | { ok: false; unauthorized: boolean }
> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) return { ok: false, unauthorized: true };

  const res = await fetch(EXPORTS_NAME_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId, folderName }),
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, unauthorized: true };
  if (res.status === 404) {
    throw new Error(
      "Job name API missing (404). Publish once in Lovable so /api/public/exports-name is live.",
    );
  }
  if (!res.ok) {
    throw new Error(`Exports name update failed (${res.status}).`);
  }
  const body = (await res.json()) as { folderName?: string; officeNameEditedAt?: string };
  return {
    ok: true,
    folderName: body.folderName?.trim() || sanitizeOfficeFolderName(folderName),
    officeNameEditedAt: body.officeNameEditedAt?.trim() || null,
  };
}

/** Netlify → Lovable: load pin notes. */
export async function fetchExportPinsViaLovableApi(
  jobId: string,
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) return { ok: false, unauthorized: true };

  const url = `${EXPORTS_PINS_URL}?jobId=${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, unauthorized: true };
  if (res.status === 404) {
    throw new Error(
      "Pin notes API missing (404). Publish once in Lovable so /api/public/exports-pins is live.",
    );
  }
  if (!res.ok) {
    throw new Error(`Exports pins read failed (${res.status})`);
  }
  const payload = (await res.json()) as OfficePinsPayload;
  return { ok: true, payload };
}

/** Netlify → Lovable: write pin description edits. */
export async function fetchUpdateExportPinsViaLovableApi(
  jobId: string,
  updates: PinDescriptionUpdate[],
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) return { ok: false, unauthorized: true };

  const res = await fetch(EXPORTS_PINS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId, updates }),
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, unauthorized: true };
  if (res.status === 404) {
    throw new Error(
      "Pin notes API missing (404). Publish once in Lovable so /api/public/exports-pins is live.",
    );
  }
  if (!res.ok) {
    throw new Error(`Exports pins update failed (${res.status})`);
  }
  const payload = (await res.json()) as OfficePinsPayload;
  return { ok: true, payload };
}

/**
 * Delete from this host’s locker only.
 * - Lovable → Supabase (old jobs).
 * - www → Blobs only. Never call Lovable delete from www (old jobs stay on lovable.app).
 */
export async function fetchDeleteExportJobFromLovable(
  jobId: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<{ ok: true; deleted: number } | { ok: false; unauthorized: boolean }> {
  if (isLovableOfficeRuntime()) {
    const result = await deleteExportJobFolderSupabase(jobId);
    return { ok: true, deleted: result.deleted };
  }

  const result = await deleteExportJobFolderBlobs(jobId);
  return { ok: true, deleted: result.deleted };
}

export async function fetchSetExportFromFromLovable(
  jobId: string,
  syncedFrom: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<{ ok: true; syncedFrom: string } | { ok: false; unauthorized: boolean }> {
  if (isLovableOfficeRuntime()) {
    const { updateExportJobFrom: updateSupa } = await import("@/server/office-mutate-supabase");
    const result = await updateSupa(jobId, syncedFrom);
    return { ok: true, syncedFrom: result.syncedFrom };
  }

  const result = await updateExportJobFromBlobs(jobId, syncedFrom);
  return { ok: true, syncedFrom: result.syncedFrom };
}

export async function fetchSetExportNameFromLovable(
  jobId: string,
  folderName: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<
  | { ok: true; folderName: string; officeNameEditedAt: string | null }
  | { ok: false; unauthorized: boolean }
> {
  if (isLovableOfficeRuntime()) {
    const { updateExportJobFolderName: updateSupa } =
      await import("@/server/office-mutate-supabase");
    const result = await updateSupa(jobId, folderName);
    return {
      ok: true,
      folderName: result.folderName,
      officeNameEditedAt: result.officeNameEditedAt,
    };
  }

  const result = await updateExportJobFolderNameBlobs(jobId, folderName);
  return {
    ok: true,
    folderName: result.folderName,
    officeNameEditedAt: result.officeNameEditedAt,
  };
}

export async function fetchExportPinsFromLovable(
  jobId: string,
  _preferredSource?: OfficeJobSource | null,
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  if (isLovableOfficeRuntime()) {
    const { readExportJobPinsSupabase } = await import("@/server/office-pins-supabase");
    const payload = await readExportJobPinsSupabase(jobId);
    return { ok: true, payload };
  }

  const payload = await readBlobsPins(jobId);
  return { ok: true, payload };
}

export async function fetchUpdateExportPinsFromLovable(
  jobId: string,
  updates: PinDescriptionUpdate[],
  _preferredSource?: OfficeJobSource | null,
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  if (isLovableOfficeRuntime()) {
    const { updateExportJobPinDescriptionsSupabase } =
      await import("@/server/office-pins-supabase");
    const payload = await updateExportJobPinDescriptionsSupabase(jobId, updates);
    return { ok: true, payload };
  }

  const payload = await updateBlobsPins(jobId, updates);
  return { ok: true, payload };
}

/** @deprecated Prefer deleteExportJobFolderBlobs / Supabase. */
export async function deleteExportJobFolder(jobId: string): Promise<{ deleted: number }> {
  if (isLovableOfficeRuntime()) return deleteExportJobFolderSupabase(jobId);
  return deleteExportJobFolderBlobs(jobId);
}

/** @deprecated */
export async function updateExportJobFrom(
  jobId: string,
  syncedFrom: string,
): Promise<{ syncedFrom: string }> {
  const r = await fetchSetExportFromFromLovable(jobId, syncedFrom);
  if (!r.ok) throw new Error("Could not update From.");
  return { syncedFrom: r.syncedFrom };
}

/** @deprecated */
export async function updateExportJobFolderName(
  jobId: string,
  folderName: string,
): Promise<{ folderName: string; officeNameEditedAt: string }> {
  const r = await fetchSetExportNameFromLovable(jobId, folderName);
  if (!r.ok) throw new Error("Could not update job name.");
  return {
    folderName: r.folderName,
    officeNameEditedAt: r.officeNameEditedAt || new Date().toISOString(),
  };
}
