/** Shared pin-notes types + CSV helpers (safe for client + server). */

export type OfficePinNote = {
  /** Stable id from pins.csv PinID column when present. */
  pinId: string;
  /** Display / fallback key — Pin column. */
  pinNum: string;
  description: string;
  /** Other CSV columns preserved on save (header → value). */
  fields: Record<string, string>;
};

export type OfficePinsPayload = {
  jobId: string;
  /** Storage path relative to job folder, e.g. files/misc/pins.csv */
  csvPath: string;
  format: "internal" | "external" | "unknown";
  pins: OfficePinNote[];
  officeNotesEditedAt: string | null;
};

export type PinDescriptionUpdate = {
  pinId?: string;
  pinNum?: string;
  description: string;
};

export const MAX_DESCRIPTION_CHARS = 8000;
export const MAX_PINS = 500;

export function csvField(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Parse one CSV line with RFC4180-ish quotes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvText(text: string): string[][] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .filter((l, idx, arr) => !(l === "" && idx === arr.length - 1));
  return lines.filter((l) => l.length > 0).map(parseCsvLine);
}

export function detectPinsFormat(headers: string[]): OfficePinsPayload["format"] {
  const lower = headers.map((h) => h.trim().toLowerCase());
  if (
    lower.includes("pinid") ||
    (lower.includes("type") && lower.includes("x") && lower.includes("y"))
  ) {
    return "internal";
  }
  if (lower.includes("location") || lower.includes("category")) {
    return "external";
  }
  return "unknown";
}

export function descriptionColumnIndex(headers: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  return lower.indexOf("description");
}

export function rowsToPins(rows: string[][]): {
  format: OfficePinsPayload["format"];
  headers: string[];
  pins: OfficePinNote[];
} {
  if (!rows.length) {
    return { format: "unknown", headers: [], pins: [] };
  }
  const headers = rows[0].map((h) => h.trim());
  const format = detectPinsFormat(headers);
  const descIdx = descriptionColumnIndex(headers);
  const pinIdx = headers.findIndex((h) => h.toLowerCase() === "pin");
  const pinIdIdx = headers.findIndex((h) => h.toLowerCase() === "pinid");
  const pins: OfficePinNote[] = [];

  for (let r = 1; r < rows.length && pins.length < MAX_PINS; r++) {
    const cols = [...rows[r]];
    while (cols.length < headers.length) cols.push("");
    const fields: Record<string, string> = {};
    headers.forEach((h, i) => {
      fields[h] = cols[i] ?? "";
    });
    const pinNum = (pinIdx >= 0 ? cols[pinIdx] : cols[0] || String(r)).trim();
    const pinId = (pinIdIdx >= 0 ? cols[pinIdIdx] : "").trim() || `row-${r}`;
    const description = descIdx >= 0 ? (cols[descIdx] ?? "") : "";
    pins.push({ pinId, pinNum, description, fields });
  }

  return { format, headers, pins };
}

export function serializePinsCsv(headers: string[], pins: OfficePinNote[]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const pin of pins) {
    const cols = headers.map((h) => csvField(pin.fields[h] ?? ""));
    lines.push(cols.join(","));
  }
  return lines.join("\r\n");
}
