#!/usr/bin/env node
/**
 * Density-aware PDF pin radius QC for public/survey.html.
 * Extracts exportPinRadius + asserts buildPinLogPdf overview opts (pins3).
 *
 * #52 (0.048 / comfortN 200 / densFloor 0.92) kept ~full size at 50 pins.
 * pins3: middle baseFrac + comfortN that actually shrinks dense jobs.
 *
 * Run: node scripts/export-pin-radius-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/survey.html'), 'utf8');

const fnStart = html.indexOf('function exportPinRadius(');
const fnEnd = html.indexOf('// Split the plan into labeled zone crops');
if (fnStart < 0 || fnEnd < 0 || fnEnd <= fnStart) {
  console.error('FAIL: could not locate exportPinRadius in public/survey.html');
  process.exit(1);
}
const exportPinRadius = new Function(
  `${html.slice(fnStart, fnEnd)}\nreturn exportPinRadius;`
)();

const pdfOptsMatch = html.match(
  /composeMapImage\('png-blob',\s*\{([^}]+)\}/
);
if (!pdfOptsMatch) {
  console.error('FAIL: could not locate buildPinLogPdf composeMapImage opts');
  process.exit(1);
}
const optsBlock = pdfOptsMatch[1];
function readOpt(name) {
  const m = optsBlock.match(new RegExp(name + '\\s*:\\s*([0-9.]+)'));
  return m ? Number(m[1]) : NaN;
}
const pdfOpts = {
  baseFrac: readOpt('baseFrac'),
  minFrac: readOpt('minFrac'),
  comfortN: readOpt('comfortN'),
  densFloor: readOpt('densFloor')
};

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

assert(pdfOpts.baseFrac === 0.038, `baseFrac is 0.038 (got ${pdfOpts.baseFrac})`);
assert(pdfOpts.minFrac === 0.016, `minFrac is 0.016 (got ${pdfOpts.minFrac})`);
assert(pdfOpts.comfortN === 36, `comfortN is 36 so countScale shrinks by ~50 pins (got ${pdfOpts.comfortN})`);
assert(pdfOpts.densFloor === 0.55, `densFloor is 0.55 (got ${pdfOpts.densFloor})`);
assert(
  html.includes("PGG_APP_VERSION = '2026.10.20-pins3'"),
  'PGG_APP_VERSION is 2026.10.20-pins3'
);

const W = 3000;
const H = 2200;
const maxDim = Math.max(W, H);

/** Place n pins on a cols×rows lattice with fixed gap (plan px). */
function latticePins(n, cols, gap) {
  const pins = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    pins.push({ x: 80 + c * gap, y: 80 + r * gap });
  }
  return pins;
}

const baseR = maxDim * pdfOpts.baseFrac;
const r52 = maxDim * 0.048; // #52 base; comfortN 200 → no count shrink at n=50
const r45 = maxDim * 0.030;

// Sparse: gaps >> 3R so densScale stays 1; countScale also 1 at n=12.
const sparse = exportPinRadius(W, H, latticePins(12, 4, 700), pdfOpts);
// Dense count: gaps still large → countScale only (simulates spread house pins).
const dense50 = exportPinRadius(W, H, latticePins(50, 10, 500), pdfOpts);
const dense80 = exportPinRadius(W, H, latticePins(80, 10, 400), pdfOpts);
// Crowded cluster: nearest-neighbor below 3R → densFloor can bite.
const crowded50 = exportPinRadius(W, H, latticePins(50, 10, 180), pdfOpts);

assert(Math.abs(sparse - baseR) < 0.5, `sparse (~12, wide gaps) stays near base (${sparse.toFixed(1)} vs ${baseR.toFixed(1)})`);
assert(dense50 < sparse, `50 spread pins smaller than sparse (${dense50.toFixed(1)} < ${sparse.toFixed(1)})`);
assert(dense80 < dense50, `80 spread pins smaller than 50 (${dense80.toFixed(1)} < ${dense50.toFixed(1)})`);
assert(crowded50 < dense50, `crowded 50 smaller than spread 50 (${crowded50.toFixed(1)} < ${dense50.toFixed(1)})`);
assert(dense50 < r52 * 0.92, `50-pin radius below #52 blot size (${dense50.toFixed(1)} < ${(r52 * 0.92).toFixed(1)})`);
assert(dense50 > r45 * 0.85, `50-pin radius still above tiny #45 floor (${dense50.toFixed(1)} > ${(r45 * 0.85).toFixed(1)})`);

const expect50 = baseR * Math.sqrt(pdfOpts.comfortN / 50);
assert(
  Math.abs(dense50 - expect50) < 1,
  `50 spread ≈ base * sqrt(36/50) (${dense50.toFixed(1)} ≈ ${expect50.toFixed(1)})`
);

console.log('\nQC radii (maxDim=3000):');
console.log(`  #45 base:       ${r45.toFixed(1)}px`);
console.log(`  #52 base:       ${r52.toFixed(1)}px`);
console.log(`  pins3 sparse:   ${sparse.toFixed(1)}px`);
console.log(`  pins3 n=50:     ${dense50.toFixed(1)}px`);
console.log(`  pins3 n=80:     ${dense80.toFixed(1)}px`);
console.log(`  pins3 crowded50:${crowded50.toFixed(1)}px`);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll export pin radius checks passed.');
