# Build all parts first, then send them in one go

Today the export hands off each ZIP part as it is built, so you get one download,
one Quick Look, one tap, repeat. That is why parts 2-4 keep stalling.

New flow: build every part first, hold them, then hand off all parts at once
through the iOS share sheet — one email with all attachments (Mail Drop handles
the size).

## What you'll see

1. Tap Export.
2. One progress panel: "Building part 2 of 4 — photo 37 of 100…". No downloads,
   no Quick Look interruptions during this stage.
3. When all parts are built: "4 files ready" with two buttons:
   - **Send / Save all** — opens the iOS share sheet once, with all 4 ZIP files
     attached. Pick Mail (one email, Mail Drop), AirDrop, or Save to Files.
   - **Download one by one** — the current fallback if the share sheet can't take
     the files.
4. Export is only marked complete after the share or the last download.

## Technical notes

In `public/survey.html`:

- Split `_runPartsExport()` into a build stage and a delivery stage. The build
  loop keeps producing one part at a time (unchanged memory profile per part) but
  pushes each finished `Blob` into an array instead of calling `_downloadBlob()`.
  Blobs are backed by disk in Safari, so holding 3-5 of them is far cheaper than
  building one giant ZIP in memory.
- Delivery uses `navigator.canShare({ files })` / `navigator.share({ files })`
  with all parts as `File` objects. If `canShare` is false or the share throws
  anything other than `AbortError`, fall back to the existing sequential
  download-with-continue-tap loop, reusing the parts already built.
- `AbortError` (user cancels the share sheet) leaves the panel open with the
  buttons still available — nothing is lost.
- Progress persistence (`pgg_parts_export_progress_v1`) is only used by the
  fallback download path; the share path clears it and sets `lastExportedAt`
  after a successful share.
- Retry/stop behavior on a failed part build stays as it is.
- No changes to pins, photos, CSV, PDF, plan storage, or setup screens.

## Risk

Holding all parts before delivery is the only new memory cost. `PARTS_BATCH`
stays at 100 so each part is built the same way it is now; if a very large job
ever fails at the build stage, lowering that number is the single knob.
