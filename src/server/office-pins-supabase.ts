/** Lovable-host Supabase pins (service role). */
import { isSafeExportJobId } from "@/server/office-blobs";
import {
  descriptionColumnIndex,
  detectPinsFormat,
  MAX_DESCRIPTION_CHARS,
  MAX_PINS,
  parseCsvText,
  rowsToPins,
  serializePinsCsv,
  type OfficePinNote,
  type OfficePinsPayload,
  type PinDescriptionUpdate,
} from "@/lib/office-pins";

export type { OfficePinNote, OfficePinsPayload, PinDescriptionUpdate };

function findPinsCsvRelativePath(objects: Array<{ relativePath: string }>): string | null {
  const exact = objects.find((o) => /(^|\/)pins\.csv$/i.test(o.relativePath));
  if (exact) return exact.relativePath;
  return null;
}

type ManifestJson = {
  version?: number;
  folderName?: string;
  uploadKind?: string;
  syncedAt?: string;
  syncedFrom?: string;
  deviceName?: string;
  officeNotesEditedAt?: string;
  files?: Array<{ path: string; zipPath: string; sizeBytes?: number }>;
  createdAt?: string;
  totalBytes?: number;
};

async function loadManifest(jobId: string): Promise<ManifestJson | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("exports")
    .download(`${jobId}/manifest.json`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as ManifestJson;
  } catch {
    return null;
  }
}

/**
 * Read misc/pins.csv (or any *pins.csv) for a synced job — Lovable / service role only.
 */
export async function readExportJobPinsSupabase(jobId: string): Promise<OfficePinsPayload> {
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
    console.error("[office-pins] list failed", jobId, e);
    throw new Error("Could not list job files.");
  }

  const csvPath = findPinsCsvRelativePath(objects);
  if (!csvPath) {
    return {
      jobId,
      csvPath: "",
      format: "unknown",
      pins: [],
      officeNotesEditedAt: null,
    };
  }

  const { data, error } = await bucket.download(`${jobId}/${csvPath}`);
  if (error || !data) {
    throw new Error(`Could not read pins.csv: ${error?.message || "missing"}`);
  }

  const text = await data.text();
  const rows = parseCsvText(text);
  const { format, pins } = rowsToPins(rows);
  const manifest = await loadManifest(jobId);
  const officeNotesEditedAt =
    typeof manifest?.officeNotesEditedAt === "string" && manifest.officeNotesEditedAt.trim()
      ? manifest.officeNotesEditedAt.trim()
      : null;

  return { jobId, csvPath, format, pins, officeNotesEditedAt };
}

/**
 * Apply description edits to pins.csv and stamp manifest.officeNotesEditedAt.
 * Does not regenerate picture map PDF (Phase A) — Download still has updated CSV.
 */
export async function updateExportJobPinDescriptionsSupabase(
  jobId: string,
  updates: PinDescriptionUpdate[],
): Promise<OfficePinsPayload> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("No pin updates provided.");
  }
  if (updates.length > MAX_PINS) {
    throw new Error("Too many pin updates.");
  }

  const current = await readExportJobPinsSupabase(jobId);
  if (!current.csvPath || !current.pins.length) {
    throw new Error("This job has no pins.csv to edit.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("exports");

  const { data, error } = await bucket.download(`${jobId}/${current.csvPath}`);
  if (error || !data) {
    throw new Error(`Could not read pins.csv: ${error?.message || "missing"}`);
  }
  const rows = parseCsvText(await data.text());
  if (!rows.length) {
    throw new Error("pins.csv is empty.");
  }
  const headers = rows[0].map((h) => h.trim());
  const descIdx = descriptionColumnIndex(headers);
  if (descIdx < 0) {
    throw new Error("pins.csv has no Description column.");
  }
  const pinIdx = headers.findIndex((h) => h.toLowerCase() === "pin");
  const pinIdIdx = headers.findIndex((h) => h.toLowerCase() === "pinid");
  const descUpdatedIdx = headers.findIndex((h) => h.toLowerCase() === "descupdatedat");
  const { pins } = rowsToPins(rows);

  const byId = new Map(pins.map((p) => [p.pinId, p]));
  const byNum = new Map(pins.map((p) => [p.pinNum, p]));
  const nowIso = new Date().toISOString();
  let changed = 0;

  for (const u of updates) {
    const desc = String(u.description ?? "").slice(0, MAX_DESCRIPTION_CHARS);
    let pin: OfficePinNote | undefined;
    if (u.pinId?.trim()) pin = byId.get(u.pinId.trim());
    if (!pin && u.pinNum?.trim()) pin = byNum.get(u.pinNum.trim());
    if (!pin) {
      throw new Error(`Unknown pin: ${u.pinId || u.pinNum || "?"}`);
    }
    if (pin.description === desc) continue;
    pin.description = desc;
    const descHeader = headers[descIdx];
    pin.fields[descHeader] = desc;
    if (descUpdatedIdx >= 0) {
      pin.fields[headers[descUpdatedIdx]] = nowIso;
    }
    changed++;
  }

  if (changed === 0) {
    return { ...current, officeNotesEditedAt: current.officeNotesEditedAt };
  }

  const ordered: OfficePinNote[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const pinNum = (pinIdx >= 0 ? cols[pinIdx] : cols[0] || String(r)).trim();
    const pinId = (pinIdIdx >= 0 ? cols[pinIdIdx] : "").trim() || `row-${r}`;
    const pin = byId.get(pinId) || byNum.get(pinNum);
    if (pin) ordered.push(pin);
  }

  const csvText = serializePinsCsv(headers, ordered);
  const blob = new Blob([csvText], { type: "text/csv" });
  const { error: upErr } = await bucket.upload(`${jobId}/${current.csvPath}`, blob, {
    contentType: "text/csv",
    upsert: true,
  });
  if (upErr) {
    console.error("[office-pins] upload failed", jobId, upErr.message);
    throw new Error(`Could not save pins.csv: ${upErr.message}`);
  }

  const manifest = (await loadManifest(jobId)) || {
    version: 1,
    folderName: jobId,
    files: [],
    createdAt: nowIso,
  };
  manifest.officeNotesEditedAt = nowIso;
  if (manifest.files?.length) {
    for (const f of manifest.files) {
      if (f.path === current.csvPath || f.zipPath?.endsWith("pins.csv")) {
        f.sizeBytes = blob.size;
      }
    }
  }
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const { error: manErr } = await bucket.upload(`${jobId}/manifest.json`, manifestBlob, {
    contentType: "application/json",
    upsert: true,
  });
  if (manErr) {
    console.warn("[office-pins] manifest stamp failed", jobId, manErr.message);
  }

  return {
    jobId,
    csvPath: current.csvPath,
    format: detectPinsFormat(headers),
    pins: ordered,
    officeNotesEditedAt: nowIso,
  };
}
