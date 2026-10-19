import { isSafeExportJobId } from "@/server/office-blobs";
import {
  listJobFiles,
  putCompleteSmallFile,
  readCompleteTextFile,
  readManifest,
  writeManifest,
} from "@/server/office-blobs";
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

/**
 * Read misc/pins.csv (or any *pins.csv) for a synced job from Blobs.
 */
export async function readExportJobPins(jobId: string): Promise<OfficePinsPayload> {
  if (!isSafeExportJobId(jobId)) {
    throw new Error("Invalid job id.");
  }

  let objects: Awaited<ReturnType<typeof listJobFiles>> = [];
  try {
    objects = await listJobFiles(jobId);
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

  const text = await readCompleteTextFile(jobId, csvPath);
  if (text == null) {
    throw new Error("Could not read pins.csv: missing");
  }

  const rows = parseCsvText(text);
  const { format, pins } = rowsToPins(rows);
  const manifest = await readManifest(jobId);
  const officeNotesEditedAt =
    typeof manifest?.officeNotesEditedAt === "string" && manifest.officeNotesEditedAt.trim()
      ? manifest.officeNotesEditedAt.trim()
      : null;

  return { jobId, csvPath, format, pins, officeNotesEditedAt };
}

/**
 * Apply description edits to pins.csv and stamp manifest.officeNotesEditedAt.
 */
export async function updateExportJobPinDescriptions(
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

  const current = await readExportJobPins(jobId);
  if (!current.csvPath || !current.pins.length) {
    throw new Error("This job has no pins.csv to edit.");
  }

  const text = await readCompleteTextFile(jobId, current.csvPath);
  if (text == null) {
    throw new Error("Could not read pins.csv: missing");
  }
  const rows = parseCsvText(text);
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
  await putCompleteSmallFile(jobId, current.csvPath, csvText, "text/csv");

  const manifest = (await readManifest(jobId)) || {
    version: 1,
    folderName: jobId,
    files: [],
    createdAt: nowIso,
  };
  manifest.officeNotesEditedAt = nowIso;
  if (manifest.files?.length) {
    for (const f of manifest.files) {
      if (f.path === current.csvPath || f.zipPath?.endsWith("pins.csv")) {
        f.sizeBytes = new TextEncoder().encode(csvText).byteLength;
      }
    }
  }
  await writeManifest(jobId, manifest);

  return {
    jobId,
    csvPath: current.csvPath,
    format: detectPinsFormat(headers),
    pins: ordered,
    officeNotesEditedAt: nowIso,
  };
}
