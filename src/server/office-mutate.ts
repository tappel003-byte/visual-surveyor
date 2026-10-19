import {
  deleteJobFolder,
  isSafeExportJobId,
  readManifest,
  writeManifest,
  type LockerManifest,
} from "@/server/office-blobs";
import type { OfficePinsPayload, PinDescriptionUpdate } from "@/lib/office-pins";
import {
  readExportJobPins,
  updateExportJobPinDescriptions,
} from "@/server/office-pins";

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
export async function deleteExportJobFolder(jobId: string): Promise<{ deleted: number }> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  return deleteJobFolder(jobId);
}

/** Update or create manifest syncedFrom / deviceName for office From column. */
export async function updateExportJobFrom(
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

  let manifest: LockerManifest = (await readManifest(jobId)) || {
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

/** Update manifest folderName — office list title / job header. */
export async function updateExportJobFolderName(
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

  let manifest: LockerManifest = (await readManifest(jobId)) || {
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

/** Blobs delete (session-gated via server fn). */
export async function fetchDeleteExportJobFromLovable(
  jobId: string,
): Promise<{ ok: true; deleted: number } | { ok: false; unauthorized: boolean }> {
  const result = await deleteExportJobFolder(jobId);
  return { ok: true, deleted: result.deleted };
}

/** Blobs From write-back. */
export async function fetchSetExportFromFromLovable(
  jobId: string,
  syncedFrom: string,
): Promise<{ ok: true; syncedFrom: string } | { ok: false; unauthorized: boolean }> {
  const result = await updateExportJobFrom(jobId, syncedFrom);
  return { ok: true, syncedFrom: result.syncedFrom };
}

/** Blobs job display-name write-back. */
export async function fetchSetExportNameFromLovable(
  jobId: string,
  folderName: string,
): Promise<
  | { ok: true; folderName: string; officeNameEditedAt: string | null }
  | { ok: false; unauthorized: boolean }
> {
  const result = await updateExportJobFolderName(jobId, folderName);
  return {
    ok: true,
    folderName: result.folderName,
    officeNameEditedAt: result.officeNameEditedAt,
  };
}

/** Blobs: load pin notes from pins.csv. */
export async function fetchExportPinsFromLovable(
  jobId: string,
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  const payload = await readExportJobPins(jobId);
  return { ok: true, payload };
}

/** Blobs: write pin description edits back to pins.csv. */
export async function fetchUpdateExportPinsFromLovable(
  jobId: string,
  updates: PinDescriptionUpdate[],
): Promise<{ ok: true; payload: OfficePinsPayload } | { ok: false; unauthorized: boolean }> {
  const payload = await updateExportJobPinDescriptions(jobId, updates);
  return { ok: true, payload };
}
