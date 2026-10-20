#!/usr/bin/env node
/**
 * Density-aware PDF pin radius QC for public/survey.html.
 * Extracts exportPinRadius + pinCenterPlan + asserts buildPinLogPdf opts (pins6).
 *
 * pins6: same baseFrac as pins5; densFloor/minFrac + diameter-aware densScale
 * so Grace-style ~49px stacks stay separable (2R < sep) like on-screen.
 *
 * Run: node scripts/export-pin-radius-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/survey.html'), 'utf8');

const helperStart = html.indexOf('function pinCenterPlan(');
const fnStart = html.indexOf('function exportPinRadius(');
const fnEnd = html.indexOf('// Split the plan into labeled zone crops');
if (helperStart < 0 || fnStart < 0 || fnEnd < 0 || fnEnd <= fnStart) {
  console.error('FAIL: could not locate pinCenterPlan/exportPinRadius in public/survey.html');
  process.exit(1);
}
const exportPinRadius = new Function(
  `${html.slice(helperStart, fnEnd)}\nreturn exportPinRadius;`
)();
const pinCenterPlan = new Function(
  `${html.slice(helperStart, fnEnd)}\nreturn pinCenterPlan;`
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

assert(typeof pinCenterPlan === 'function', 'pinCenterPlan helper exists');
const sample = pinCenterPlan({ x: 12.5, y: 99 });
assert(sample.x === 12.5 && sample.y === 99, 'pinCenterPlan returns plan x/y');

assert(pdfOpts.baseFrac === 0.027, `baseFrac is 0.027 (got ${pdfOpts.baseFrac})`);
assert(pdfOpts.minFrac === 0.008, `minFrac is 0.008 so dense stacks can shrink (got ${pdfOpts.minFrac})`);
assert(pdfOpts.comfortN === 36, `comfortN is 36 so countScale shrinks by ~50 pins (got ${pdfOpts.comfortN})`);
assert(pdfOpts.densFloor === 0.22, `densFloor is 0.22 (got ${pdfOpts.densFloor})`);
assert(
  html.includes("PGG_APP_VERSION = '2026.10.20-pins6'"),
  'PGG_APP_VERSION is 2026.10.20-pins6'
);
assert(
  html.includes('pinCenterPlan(p)') && html.includes('function renderPins()'),
  'renderPins and composeMapImage share pinCenterPlan'
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
const r52 = maxDim * 0.048;
const r45 = maxDim * 0.030;
const rPins4 = maxDim * 0.032;

// Sparse: gaps >> 2.2R so densScale stays 1; countScale also 1 at n=12.
const sparse = exportPinRadius(W, H, latticePins(12, 4, 700), pdfOpts);
// Dense count: gaps still large → countScale only (simulates spread house pins).
const dense50 = exportPinRadius(W, H, latticePins(50, 10, 500), pdfOpts);
const dense80 = exportPinRadius(W, H, latticePins(80, 10, 400), pdfOpts);
// Crowded cluster: nearest-neighbor below 2.2R → densFloor / gap fit bites.
const crowded50 = exportPinRadius(W, H, latticePins(50, 10, 100), pdfOpts);

assert(Math.abs(sparse - baseR) < 0.5, `sparse (~12, wide gaps) stays near base (${sparse.toFixed(1)} vs ${baseR.toFixed(1)})`);
assert(dense50 < sparse, `50 spread pins smaller than sparse (${dense50.toFixed(1)} < ${sparse.toFixed(1)})`);
assert(dense80 < dense50, `80 spread pins smaller than 50 (${dense80.toFixed(1)} < ${dense50.toFixed(1)})`);
assert(crowded50 < dense50, `crowded 50 smaller than spread 50 (${crowded50.toFixed(1)} < ${dense50.toFixed(1)})`);
assert(dense50 < r52 * 0.92, `50-pin radius below #52 blot size (${dense50.toFixed(1)} < ${(r52 * 0.92).toFixed(1)})`);
assert(dense50 > r45 * 0.7, `50-pin radius still above tiny #45 floor (${dense50.toFixed(1)} > ${(r45 * 0.7).toFixed(1)})`);
assert(sparse < rPins4 * 0.9, `pins6 sparse keeps pins5 base under pins4 (${sparse.toFixed(1)} < ${(rPins4 * 0.9).toFixed(1)})`);

const expect50 = baseR * Math.sqrt(pdfOpts.comfortN / 50);
assert(
  Math.abs(dense50 - expect50) < 1,
  `50 spread ≈ base * sqrt(36/50) (${dense50.toFixed(1)} ≈ ${expect50.toFixed(1)})`
);

// Grace-like vertical stack: ~60 pins, nearest distinct gap ~49px on 1292×2583.
const graceH = 2583;
const graceW = 1292;
const graceSep = 49;
const gracePins = [];
for (let i = 0; i < 57; i++) {
  gracePins.push({ x: 200 + (i % 8) * 120, y: 200 + Math.floor(i / 8) * 140 });
}
gracePins.push({ x: 1007, y: 2402 });
gracePins.push({ x: 1026, y: 2451 });
gracePins.push({ x: 1031, y: 2494 });
const graceR = exportPinRadius(graceW, graceH, gracePins, pdfOpts);
assert(
  graceR * 2 < graceSep,
  `Grace-like stack: diameter fits gap (${(graceR * 2).toFixed(1)} < ${graceSep})`
);

console.log('\nQC radii (maxDim=3000):');
console.log(`  pins6 sparse:   ${sparse.toFixed(1)}px`);
console.log(`  pins6 n=50:     ${dense50.toFixed(1)}px`);
console.log(`  pins6 n=80:     ${dense80.toFixed(1)}px`);
console.log(`  pins6 crowded50:${crowded50.toFixed(1)}px`);
console.log(`  Grace-like R:   ${graceR.toFixed(1)}px (2R=${(graceR * 2).toFixed(1)} vs sep ${graceSep})`);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll export pin radius checks passed.');
