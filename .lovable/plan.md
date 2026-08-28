# Fix: large exports failing (150 quick-capture + 80 pin photos)

## What's going wrong

The current export builds the entire job in phone memory at once, three times over:

1. Every photo is pulled out of storage as a base64 text string (base64 is ~33% bigger than the real image).
2. Every one of those strings is handed to the ZIP library, which keeps them all in memory.
3. The library then builds one single ZIP blob — a second full copy of everything — before the download starts.

With ~230 photos that's easily 1-2 GB of memory churn on an iPhone. Safari kills the tab or the ZIP step throws long before the file is written. Nothing is lost — the photos are all safe in the app's storage — but the single all-in-one ZIP is too big to assemble on the phone.

## The fix — two parts

### 1. Make the normal export leaner (helps every job)

- Read each photo out of storage as a real binary blob instead of a base64 string, and hand the blob straight to the ZIP. This cuts peak memory roughly in half and removes the base64 conversion entirely.
- Release each photo from memory right after it's added, instead of holding all of them.
- Keep photos stored uncompressed inside the ZIP (JPEGs don't compress further) so the ZIP step stays cheap.
- Show real progress on the button ("Photo 63 of 230…") instead of a static "Bundling…" so a slow export doesn't look frozen.

This alone may be enough for many jobs, but it is not safe to rely on for a 230-photo job.

### 2. Add "Export in parts" — the guaranteed path off the phone

A second button in the Export sheet that never builds one giant file. It downloads a numbered series of smaller ZIPs, one at a time, each well under the size where Safari struggles:

```text
1234-main-st--part-1-of-6.zip   plan, map.png, pins.csv, pinlog.pdf, quick-capture.csv
1234-main-st--part-2-of-6.zip   photos 1-50
1234-main-st--part-3-of-6.zip   photos 51-100
...
```

Behavior:
- Batch size is fixed at 50 photos per part (tunable in one constant).
- After each part downloads, the app pauses and shows "Part 2 of 6 saved — tap to continue", so iOS's one-download-at-a-time behavior doesn't drop files, and you can confirm each one landed before moving on.
- Each part is self-describing: the same folder name inside, so unzipping all parts into one folder on the computer reassembles the original structure exactly.
- If a part fails, you can retry just that part — you don't restart the whole export.
- Export status ("Changes since export") only flips to exported once the final part completes.

### 3. Automatic — you don't have to remember which button to press

The single Export button decides for you: it counts the photos first, and if the job is over the threshold (100 photos) it switches itself into parts mode and tells you "This job has 230 photos — it'll download in 6 parts." Under the threshold, it behaves exactly as it does today.

At 500 photos this is 11 parts of 50 — same mechanism, just more parts. There is no ceiling: the only thing that grows is the number of downloads, and each individual ZIP stays the same modest size regardless of job size. That's the answer to the capacity concern — the phone never has to hold the whole job in memory at once, so a 500-photo job is no riskier than a 50-photo one.

### Also

- The existing failure alert will report the real error name and message (and the photo it died on), so if something still fails we know exactly where instead of guessing.


## Nothing else changes

No changes to pins, photo capture, quick capture, the plan canvas, GPS, room detection, the PDF layout, CSV columns, setup screens, or storage. The single-ZIP export button stays exactly where it is and keeps working for normal-sized jobs.

## Technical notes

- `public/survey.html` only.
- `resolvePhoto()` gets a blob-returning sibling (`resolvePhotoBlob()`) that converts the stored data URL to a `Blob` via `fetch(dataUrl).blob()` and is used by both export paths.
- `exportProjectZip()` is refactored into a shared `collectExportItems()` (metadata + ordered photo manifest) plus a writer, so the single-ZIP and parts exports share all naming/numbering logic and can't drift.
- Parts export uses `zip.generateAsync({ type: 'blob', compression: 'STORE' })` per batch, awaiting a user tap between downloads.
