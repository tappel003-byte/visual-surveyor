# Make exports small enough for one tap

## What I found

I traced how photos get into the export, and there's a clear culprit.

- Pin photos are downscaled on capture: long edge capped at 1600px, JPEG quality 0.85.
- Quick Capture photos are **not** downscaled. Each burst frame is saved straight from the camera video at full sensor resolution, JPEG 0.88.

So a Quick Capture-heavy job stores photos several times larger than pin photos, for images nobody zooms into. That's what pushes a job past the single-ZIP limit (400MB of photo bytes) and into the 25-part upload path.

## The fix

1. **Downscale Quick Capture on capture** — run burst frames through the same cap used everywhere else (1600px long edge, JPEG 0.85). Typical result: 4-8x smaller per photo, visually identical on a report page.

2. **Add a one-time "Shrink photos" cleanup** in the work menu, so jobs already sitting on the phone with full-size burst photos can be compacted in place without re-shooting. Shows before/after size, keeps the same photo IDs so nothing else changes.

3. **Leave the export path exactly as it is.** Multi-part and the cloud link stay in place as the safety net for genuinely huge jobs — they just stop being the normal experience. No new steps for your engineers: tap Export, one ZIP lands in Files.

## What this does not change

- No change to how photos are captured, viewed, annotated, or numbered.
- No change to the export format, CSVs, PDF, or the cloud link page.
- No separate Quick Capture export or extra download step — that idea is off the table for now.

## Technical detail

In `public/survey.html`, `qcCaptureFrame()` draws the video frame at `videoWidth x videoHeight` and calls `toDataURL('image/jpeg', 0.88)`. Change it to scale the canvas down to `MAX_PHOTO_DIM` (1600) on the long edge before encoding, matching the pin-photo path at line 4589. The cleanup pass re-reads each `quickCapture[]` blob from IndexedDB, re-encodes anything over the cap, and writes it back under the same `pl_`/photo ID.
