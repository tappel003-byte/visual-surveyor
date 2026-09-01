# One ZIP, one wait — build it in the cloud, not on the phone

You're right about the destination: one file, one wait, done. The disagreement is only about *where* the ZIP gets built.

## Why the phone can't build the one big ZIP

That's the original failure. To hand Safari a single 400MB ZIP, the phone has to hold the whole thing in memory at once — every photo decoded, plus the assembled archive. That's exactly what was crashing on the 230-photo job, and it's why the export got split into 25 parts in the first place. Making the ZIP bigger makes that worse, not better.

Uploading 250 individual files looks like more work but is actually less: each file is a few hundred KB, memory never spikes, and if the connection drops it resumes at file 187 instead of starting a 400MB upload over.

## The fix: the phone uploads files, the server hands back one ZIP

Same end result you described, with the heavy lifting moved somewhere that can take it.

```text
phone                          cloud
-----                          -----
upload photo 1..250   ------>  stored as raw files
upload manifest.json  ------>
                               [server streams them into one ZIP]
open link             <------  job-1234.zip   (one file, one download)
```

From your side it's still: tap Export, wait, get one ZIP. You just get it from a link instead of out of the phone's memory.

## What gets built

1. **Packaging endpoint** — a server route that reads a job's uploaded files and streams them back as a single ZIP. Streaming means the server never holds the whole archive in memory either, so there's no size ceiling to run into later.
2. **The pin log PDF and CSV** get generated into that same ZIP, so the downloaded file is identical in structure to today's on-device export.
3. **Export screen becomes one path** — upload with a progress count ("photo 143 of 250"), then a "Download ZIP" link when it finishes. The multi-part export path gets removed; it exists only to work around the memory limit we're no longer hitting.
4. **Resume stays** — if the app is backgrounded mid-upload, reopening picks up where it left off. Already how the raw upload works; this keeps it.

## Photo quality goes back up

The reason quality got cut to 1600px was to make on-device ZIPs fit. Once the ZIP isn't built on-device, that constraint is gone. Photos get stored at a defensible evidence resolution instead — 2560px long edge at high quality, so a hairline crack survives being zoomed into.

Quick Capture bursts stay at the lower setting, since those are context shots, not evidence.

## Technical notes

- New server route under `src/routes/api/` that lists a job's objects in storage and streams a ZIP response (sequential ZIP writing, no full buffering — safe inside the Worker runtime).
- Reuses the existing `_uploadRawAssets` / tus upload path in `public/survey.html`; no change to how files get up there.
- `buildPinLogPdf()` output and `pins.csv` are uploaded alongside the photos so the server just packs what it's given.
- Removes the multipart ZIP part-splitting code and its resume bookkeeping.
- `MAX_PHOTO_DIM` raised to 2560 with quality 0.92 for pin photos; Quick Capture keeps 1600 / 0.85.

## What this costs you

Export now needs signal to complete. Today's on-device ZIP works with no connection at all. If you're in a basement with no bars, the upload waits until you have service. Worth naming before we commit to it — if fully-offline export has to keep working, we keep the on-device ZIP as a fallback for small jobs and this becomes the path for big ones.
