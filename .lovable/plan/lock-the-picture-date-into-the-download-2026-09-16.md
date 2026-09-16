# Lock the picture date into the download

Right now every file in the ZIP gets stamped with the moment the ZIP was built, so photos taken three weeks ago show today's date on your computer. The date each picture was actually taken is already stored in the app, but it never makes it into the download.

## What changes

- Each photo in the download carries its own capture date and time as its file date, so Finder/Explorer shows the day it was taken, not the day you downloaded it.
- The other files in the download (picture map.pdf, the CSVs, map and plan images) are stamped with the survey date, so the whole download stays consistent.
- Nothing about folder names, file names, photo quality, pins, or export size behavior changes.

## Notes on accuracy

- Photos taken in the app and quick-capture shots have a real capture time, so those are exact.
- Photos imported from the phone's library carry the time they were added to the job, since that's the only time the app recorded for them.
- This sets the file's created/modified date. It does not rewrite the date stored inside the photo's own EXIF data.

## Technical detail

In `public/survey.html`, inside `collectExportItems()`:

- Add a `_entryDate(entry, fallback)` helper that decodes `ph_<base36>` photo ids into a `Date`, falling back to the survey date.
- Give every pushed photo manifest item a `date` field; quick-capture items use `new Date(e.ts)`.
- Give every `meta` entry a `date` of the survey date.
- In `_addPhotosToZip`, pass `{ date: item.date }` to the JSZip `.file(...)` call; in `_addMetaToZip`, pass `{ date: f.date }`.

Parts export, cloud manifest and the `/get` page all build from `collectExportItems()`, so they inherit the dates automatically.
