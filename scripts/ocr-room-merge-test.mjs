#!/usr/bin/env node
/**
 * Focused unit-ish test for OCR room dedupe in public/survey.html.
 * Extracts the helper block so it stays in sync with the live page.
 *
 * Bug: one printed "2 CAR GARAGE" became Garage 1/2/3 (line vs word vs rotate).
 * Also: weak same-name ghosts should not become Bedroom 4/5.
 *
 * Run: node scripts/ocr-room-merge-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/survey.html'), 'utf8');
const start = html.indexOf('const OCR_SAME_NAME_MERGE_R');
const end = html.indexOf('async function ocrScanRoomsForSetup');
if (start < 0 || end < 0 || end <= start) {
  console.error('FAIL: could not locate OCR merge helpers in public/survey.html');
  process.exit(1);
}
const block = html.slice(start, end);
const factory = new Function(
  'matchRoomKeyword',
  'cleanRoomNumber',
  `${block}\nreturn { clusterOcrRoomCandidates, filterOcrRoomClusters, numberOcrRoomClusters, _ocrBBoxOverlapOrContain };`
);
const {
  clusterOcrRoomCandidates,
  filterOcrRoomClusters,
  numberOcrRoomClusters,
  _ocrBBoxOverlapOrContain
} = factory(() => null, () => null);

function cand(name, x, y, conf, src, kind = 'preset', bbox = null) {
  return { name, x, y, conf, src, kind, bbox };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

// 1) Line center + word center + rotate pass for one Garage → one room, unnumbered
{
  const lineBb = { x0: 0.08, y0: 0.40, x1: 0.28, y1: 0.46 };
  const wordBb = { x0: 0.20, y0: 0.40, x1: 0.28, y1: 0.46 }; // GARAGE at right of "2 CAR GARAGE"
  const lineCx = (lineBb.x0 + lineBb.x1) / 2; // 0.18
  const wordCx = (wordBb.x0 + wordBb.x1) / 2; // 0.24
  assert(Math.hypot(lineCx - wordCx, 0) > 0.05, 'fixture: line vs word centers differ by >0.05');
  const candidates = [
    cand('Garage', lineCx, 0.43, 82, 'upright sparse', 'preset', lineBb),
    cand('Garage', wordCx, 0.43, 88, 'upright sparse', 'preset', wordBb),
    cand('Garage', wordCx + 0.01, 0.44, 75, 'sideways CW', 'preset', {
      x0: wordBb.x0 + 0.01, y0: wordBb.y0 + 0.01, x1: wordBb.x1 + 0.01, y1: wordBb.y1 + 0.01
    }),
    cand('Garage', lineCx - 0.02, 0.42, 70, 'color room labels', 'preset', {
      x0: lineBb.x0 - 0.02, y0: lineBb.y0, x1: lineBb.x1 - 0.02, y1: lineBb.y1
    }),
  ];
  const clusters = clusterOcrRoomCandidates(candidates);
  const kept = filterOcrRoomClusters(clusters);
  const numbered = numberOcrRoomClusters(kept);
  assert(numbered.length === 1, 'single Garage label → 1 room (got ' + numbered.length + ')');
  assert(numbered[0] && numbered[0].name === 'Garage', 'name stays Garage not Garage 1 (got ' + (numbered[0] && numbered[0].name) + ')');
}

// 2) Overlapping same-name boxes merge even if centers are a bit far
{
  const a = { x0: 0.50, y0: 0.50, x1: 0.62, y1: 0.56 };
  const b = { x0: 0.58, y0: 0.51, x1: 0.70, y1: 0.57 }; // overlaps a
  assert(_ocrBBoxOverlapOrContain(a, b), 'fixture boxes overlap');
  const candidates = [
    cand('Dining Room', 0.56, 0.53, 80, 'upright sparse', 'preset', a),
    cand('Dining Room', 0.64, 0.54, 78, 'upright blocks', 'preset', b), // center ~0.08 away
  ];
  const numbered = numberOcrRoomClusters(filterOcrRoomClusters(clusterOcrRoomCandidates(candidates)));
  assert(numbered.length === 1 && numbered[0].name === 'Dining Room', 'overlapping Dining Room boxes → one unnumbered');
}

// 3) Two real Bedrooms far apart with 2+ passes each → Bedroom 1 / Bedroom 2
{
  const candidates = [
    cand('Bedroom', 0.20, 0.20, 85, 'upright sparse'),
    cand('Bedroom', 0.20, 0.21, 80, 'upright blocks'),
    cand('Bedroom', 0.80, 0.70, 84, 'upright sparse'),
    cand('Bedroom', 0.81, 0.70, 79, 'color room labels'),
  ];
  const numbered = numberOcrRoomClusters(filterOcrRoomClusters(clusterOcrRoomCandidates(candidates)));
  const names = numbered.map(r => r.name).sort();
  assert(names.length === 2, 'two far Bedrooms → 2 rooms (got ' + names.length + ')');
  assert(names[0] === 'Bedroom 1' && names[1] === 'Bedroom 2', 'numbered Bedroom 1 and 2 (got ' + names.join(', ') + ')');
}

// 4) Ghost Bedroom near Kitchen: single-pass high-conf → merge away, no Bedroom 4/5
{
  const candidates = [
    cand('Bedroom', 0.15, 0.30, 90, 'upright sparse'),
    cand('Bedroom', 0.16, 0.30, 85, 'upright blocks'),
    cand('Bedroom', 0.55, 0.55, 72, 'sideways CW'), // ghost near kitchen — one pass only
    cand('Kitchen', 0.58, 0.56, 88, 'upright sparse'),
    cand('Kitchen', 0.58, 0.57, 82, 'color room labels'),
  ];
  const numbered = numberOcrRoomClusters(filterOcrRoomClusters(clusterOcrRoomCandidates(candidates)));
  const bedrooms = numbered.filter(r => /^Bedroom/.test(r.name));
  const kitchens = numbered.filter(r => r.name === 'Kitchen');
  assert(bedrooms.length === 1 && bedrooms[0].name === 'Bedroom', 'ghost Bedroom merged; one unnumbered Bedroom');
  assert(kitchens.length === 1, 'Kitchen stays one room');
}

// 5) Weak same-name extras within 0.14 of a durable hit → one room
{
  const candidates = [
    cand('Patio', 0.40, 0.80, 86, 'upright sparse'),
    cand('Patio', 0.41, 0.81, 80, 'upright blocks'),
    cand('Patio', 0.50, 0.82, 70, 'sideways CCW'), // ~0.10 away, one pass
  ];
  const numbered = numberOcrRoomClusters(filterOcrRoomClusters(clusterOcrRoomCandidates(candidates)));
  assert(numbered.length === 1 && numbered[0].name === 'Patio', 'Patio extras within merge radius → one Patio');
}

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll OCR room-merge checks passed.');
