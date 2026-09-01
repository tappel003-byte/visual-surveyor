# Keep the offline ZIP. Make it faster. Don't touch quality yet.

The previous draft was wrong in the ways you named. Conceding them plainly:

- It didn't touch the five minutes — it reused `_uploadRawAssets` unchanged and added a server step after it.
- It made the upload heavier by raising photos to 2560/0.92.
- It traded away offline export for exactly the large jobs that are the pain point.

Scrapped. Here's what the code actually says and what follows from it.

## What's already true in the live code

- `SINGLE_ZIP_LIMIT` is 400 MB (line ~5955). Any job under that already builds **one ZIP, on device, fully offline**. No parts, no upload, no signal.
- The 250-file cloud upload only happens two ways: the job exceeds 400 MB, or you tap the cloud button yourself.
- Pin photos are capped at 1600 px / 0.85; Quick Capture now matches after the shrink change.

So the one-file offline export you want already exists. The five-minute wait came from being pushed into the upload path — which means the real question isn't "how do we make uploading better," it's "why did this job leave the offline path at all."

## The work

1. **Find out where the time actually goes.** Instrument the on-device ZIP build to report elapsed time for the two stages that can be slow: reading photos out of IndexedDB, and JSZip writing the archive. Right now `_addPhotosToZip` reads photos strictly one at a time and yields to Safari every 10 (line ~6168). That's conservative and may be leaving real speed on the table — but I'm not going to claim it's the bottleneck before measuring it.

2. **Speed up the read loop based on what step 1 shows.** Most likely change: read photos from IndexedDB a few at a time instead of strictly one-by-one, keeping the periodic yield so Safari doesn't get starved. Memory stays flat because each blob is handed to JSZip and released immediately. If measurement says the time is in `generateAsync` instead, this step changes shape — that's why it comes second.

3. **Make the offline path harder to fall out of.** Show the job's photo total in the export sheet before you tap, so a job creeping toward the 400 MB line is visible rather than a surprise. If a job does exceed it, the prompt says why in plain terms and offers the cloud path as a choice, not a default.

4. **Cloud upload stays exactly as built.** It's tested, it resumes, and it's the right tool when a job genuinely is too big. It just stops being anything you land in by accident.

## Photo quality — separate decision, deliberately not bundled here

Raising resolution costs export time and job size, and you're right that folding it into a plan about speed is working against itself. It's a real question for an engineering firm and it deserves its own answer with numbers: how many photos a typical job holds, what 2048 or 2560 does to the total, and how much headroom is left under 400 MB. I'd rather bring you that measurement and let you decide than slip a 2.5x pixel increase into a performance fix.

## What this does not change

Offline export, on-device ZIP, ZIP contents, pins, photos, CSV, the pin-log PDF, the `/get` download page, or the resume logic.

## Technical notes

- `public/survey.html` only; no backend, no `src/routes/get.tsx` change.
- Timing instrumentation around `_addPhotosToZip` and `zip.generateAsync` in `exportProjectZip()` (line ~6548), reported into the existing export panel so it's visible on device rather than only in a desktop console.
- Any concurrency change stays inside `_addPhotosToZip`; the annotated-photo branch (`compositePhotoWithStrokes`) stays sequential since it decodes to a canvas.
- Export sheet gains a size readout from the existing `_totalPhotoBytes()` helper.
