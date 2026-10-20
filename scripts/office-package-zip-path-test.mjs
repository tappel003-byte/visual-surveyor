#!/usr/bin/env node
/**
 * QC: Download package ZIP entry paths (Grace-like layout).
 *
 * Asserts:
 * - No nested copy of the job folder name inside the ZIP
 * - Directory-only labels are rejected (no empty folder shells)
 * - Day folder grouping for skip notes
 *
 * Run: node scripts/office-package-zip-path-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadZip } from "client-zip";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/lib/office-package-download.ts"), "utf8");

function extractExportedFn(name) {
  const re = new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}\\n`);
  const m = src.match(re);
  if (!m) {
    console.error(`FAIL: could not locate export function ${name}`);
    process.exit(1);
  }
  // Strip TS so new Function can run the helper as plain JS.
  return m[0]
    .replace(/^export /, "")
    .replace(/\?: string \| null/g, "")
    .replace(/\?: string/g, "")
    .replace(/: string \| null/g, "")
    .replace(/: string/g, "");
}

const buildOfficeZipEntryPath = new Function(
  `${extractExportedFn("buildOfficeZipEntryPath")}\nreturn buildOfficeZipEntryPath;`,
)();
const zipEntryDayFolder = new Function(
  `${extractExportedFn("zipEntryDayFolder")}\nreturn zipEntryDayFolder;`,
)();

const JOB = "4910_Grace_St_SW_Los_Lunas_NM";
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// Flat layout — ZIP filename is the job; entries are day/misc only.
assert(
  buildOfficeZipEntryPath("3498_2026-10-15/photo-01.jpg", JOB) ===
    "3498_2026-10-15/photo-01.jpg",
  "day photo stays under day folder only",
);
assert(
  buildOfficeZipEntryPath("misc/pins.csv", JOB) === "misc/pins.csv",
  "misc file at ZIP root misc/",
);
assert(
  buildOfficeZipEntryPath("3498_2026-10-15/picture map.pdf", JOB) ===
    "3498_2026-10-15/picture map.pdf",
  "picture map keeps spaces + day folder",
);

// Strip baked-in job name (old manifests / double-nest bug).
assert(
  buildOfficeZipEntryPath(`${JOB}/3498_2026-10-15/photo-01.jpg`, JOB) ===
    "3498_2026-10-15/photo-01.jpg",
  "strips one nested job folder from label",
);
assert(
  buildOfficeZipEntryPath(`${JOB}/${JOB}/3498_2026-10-15/photo-01.jpg`, JOB) ===
    "3498_2026-10-15/photo-01.jpg",
  "strips repeated nested job folders",
);

// Reject empty / directory-only (would become empty folders in client-zip).
assert(buildOfficeZipEntryPath("3498_2026-10-15/", JOB) === null, "reject trailing slash dir");
assert(buildOfficeZipEntryPath(JOB, JOB) === null, "reject bare job folder label");
assert(buildOfficeZipEntryPath("", JOB) === null, "reject empty label");
assert(buildOfficeZipEntryPath("/", JOB) === null, "reject slash-only");

assert(zipEntryDayFolder("3498_2026-10-15/photo-01.jpg") === "3498_2026-10-15", "day folder parse");
assert(zipEntryDayFolder("misc/pins.csv") === "misc", "misc folder parse");
assert(zipEntryDayFolder("readme.txt") === null, "root file has no day folder");

// Live ZIP: skipped day must not leave an empty folder entry.
const saved = [
  { name: "misc/map.png", input: "png" },
  { name: "misc/pins.csv", input: "csv" },
  // Intentionally omit 3498_2026-10-15/* — all photos "skipped"
  { name: "_download-notes.txt", input: "notes about empty day\n" },
];
const blob = await downloadZip(saved).blob();
const unzipped = await JSZip.loadAsync(await blob.arrayBuffer());
const names = Object.keys(unzipped.files).sort();
assert(
  !names.some((n) => n.includes("3498_2026-10-15")),
  "ZIP has no empty 3498 day folder when all day files skipped",
);
assert(
  names.includes("misc/map.png") && names.includes("_download-notes.txt"),
  "ZIP keeps misc + download notes",
);
assert(
  !names.some((n) => n.startsWith(JOB + "/")),
  "ZIP does not nest under job folder name",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll office-package zip path checks passed.");
