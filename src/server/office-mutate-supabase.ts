/**
 * Lovable-host Supabase mutate helpers (service role).
 * Used when /office runs on lovable.app — not on Netlify.
 */
import { isSafeExportJobId } from "@/server/office-blobs";

function sanitizeOfficeFolderName(raw: string): string {
  return raw
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

type ManifestJson = {
  version?: number;
  folderName?: string;
  uploadKind?: string;
  syncedAt?: string;
  syncedFrom?: string;
  deviceName?: string;
  files?: Array<{ path: string; zipPath: string }>;
  createdAt?: string;
  officeNameEditedAt?: string;
};

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
    throw new Error(`Could not save From: ${upErr.message}`);
  }

  return { syncedFrom: label };
}

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

  const nowIso = new Date().toISOString();
  manifest.folderName = label;
  manifest.officeNameEditedAt = nowIso;
  if (!manifest.version) manifest.version = 1;

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const { error: upErr } = await bucket.upload(manifestPath, blob, {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) {
    throw new Error(`Could not save job name: ${upErr.message}`);
  }

  return { folderName: label, officeNameEditedAt: nowIso };
}
