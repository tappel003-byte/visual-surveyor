# Put the plain ZIP back in charge

Right now any job whose photos add up to more than 45 MB is pushed straight into the
"cloud upload / split into parts" flow. That is why an ordinary job with quick captures
and a handful of photos suddenly became a 250-file upload. 45 MB is far too low a bar —
a phone can build a much bigger ZIP than that without trouble.

## What changes

1. **One-tap ZIP is the default again.**
   Tapping "Finish & Export (ZIP)" builds a single ZIP and downloads it, the way it used
   to. No prompts, no parts, no cloud.

2. **The cutover point moves way up.**
   The automatic "this is too big to build here" path only triggers for genuinely large
   jobs (raise the threshold from 45 MB to roughly 400 MB of photos). Everything below
   that just downloads as one file.

3. **Cloud upload becomes a choice you make, not one made for you.**
   A second, smaller "☁️ Upload & get one link" button sits next to the ZIP button in the
   export sheet, available on every job regardless of size. Tap it when you want the
   link; ignore it otherwise.

4. **If the ZIP genuinely fails, offer the escape hatch.**
   If building the single ZIP runs out of memory, show the existing panel with
   "Upload & get one link" and "Split into parts" instead of just an error alert.

Nothing about the upload machinery, the resume logic, or the /get download page changes —
it stays exactly as built and tested. It just stops being mandatory.

## Technical notes

- `public/survey.html`
  - `PART_SIZE_TARGET` (line ~5894) stays as the per-part size for split ZIPs; introduce a
    separate `SINGLE_ZIP_LIMIT` (~400 MB) used by `exportProjectZip()` for the
    auto-fallback decision, so part sizing and the fallback trigger stop sharing one number.
  - `exportProjectZip()` (line ~6444): compare `totalBytes` against `SINGLE_ZIP_LIMIT`
    instead of `PART_SIZE_TARGET`; wrap the single-ZIP build so an out-of-memory throw
    falls through to `_runPartsExport(items, setLabel)` rather than the raw `alert()`.
  - Export sheet markup: add a `cloudUploadBtn` beside `exportZipBtn` that calls a small
    wrapper invoking the existing cloud branch of `_runPartsExport` directly.
  - `_runPartsExport()` keeps its current prompt wording for the automatic path.
- No backend, storage, or `src/routes/get.tsx` changes.
