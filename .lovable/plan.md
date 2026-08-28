# Make the multi-part export painless

The parts mechanism works and stays. What changes is everything around it: no up-front warning box, no tap between every part, fewer parts, and a clear finish state.

## What you'll see

1. Tap Export. No alert to dismiss.
2. One progress panel appears: "Exporting 230 photos — part 3 of 4, photo 118 of 230". It stays on screen the whole time.
3. Parts download one after another automatically, a couple of seconds apart. You don't touch anything.
4. At the end: "Done — 4 files saved. Put all 4 in one folder on your computer and unzip them there."

## Fewer parts

Batch size goes from 50 to 75 photos per part, and metadata (plan, map, CSVs, PDF) rides along in part 1 instead of getting a part to itself. A 230-photo job goes from 6 downloads to 4. A 500-photo job goes from 11 to 7. Each ZIP still stays modest, so the phone never builds a huge file.

## If iOS interrupts

Safari sometimes stops silently after the first file when downloads fire back-to-back. The app watches for that: if a part doesn't appear to start, the panel switches to a single "Tap to continue — part 3 of 4" button for that part only, then resumes automatic mode. So the tapping only happens if the phone forces it, not every time.

Any part that fails gets a "Retry part 3" button — you never restart the whole export.

## Unzipping stays one folder

Every part contains the same top-level folder name, so unzipping all of them into one place rebuilds the original structure. Part 1 also includes a short README.txt saying exactly that, in case someone else on the team receives the files.

## Export status

The job is only marked exported after the last part lands. Stopping early leaves it as "Changes since export" — nothing is lost either way.

## Technical notes

- `public/survey.html` only.
- `PARTS_BATCH` 50 -> 75; metadata folded into part 1 alongside its photo batch; part count = `ceil(photos / 75)`.
- Replace the `alert()` + `_awaitPartContinue()` per-part gate with a persistent in-page progress modal (styled like the existing save-failure modal) driven by the same `setLabel` callback.
- Between parts: `await` a short delay, then trigger the next `_downloadBlob`. Gate fallback fires only when the auto-trigger is blocked; retry/stop buttons live in the same modal.
- `collectExportItems()`, `_addPhotosToZip()`, blob streaming, STORE compression, naming, and numbering all stay as they are.
