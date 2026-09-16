# Rename export folders and lock in photo dates

## New export layout

Today a job unzips like this:

```text
1234-main-st/
  photos/            photo-01.jpg ...
  quick-capture/
  pinlog.pdf
  map.png
  plan.png
  pins.csv
```

After this change:

```text
1234-main-st/
  2026-08-26_damage-locations/
    photo-01.jpg ...
    picture-map.pdf
  MISC 2026-08-26/
    map.png
    plan.png
    pins.csv
    quick-capture/ (photos + csv, unchanged inside)
```

- `pinlog.pdf` is renamed **picture-map.pdf** and moves inside the photos folder.
- The photos folder is renamed **`<date>_damage-locations`**.
- Everything else moves into **`MISC <date>`**.
- Date format is `YYYY-MM-DD` so folders sort correctly; easy to change later.
- The date used is the date of the earliest photo in the job (the day the survey
  was walked). If a job has no photos, the date the job was created is used.

## Locking in the picture date

Yes, this is doable. Every photo already carries the moment it was taken inside
its internal ID, so we can stamp that exact date onto each file as it is written
into the ZIP. When you unzip on the computer, the file's date shows the day the
picture was taken instead of the day you downloaded it.

Caveats worth knowing up front:

- This sets the file's **modified date**, which is what Finder/Explorer show and
  sort by. macOS and Windows both set "date created" to the moment of unzipping;
  no ZIP can control that.
- Photos imported from the camera roll rather than taken in the app get stamped
  with the time they were added to the job, which is the closest thing the app
  knows.
- Quick-capture photos already store a real timestamp and use that.
- The PDF, CSV, map and plan files get the survey date too, so the whole export
  reads as one day's work.

## Technical notes

All in `public/survey.html`:

- `collectExportItems()` gains a survey-date helper (earliest photo timestamp,
  decoded from the `ph_<base36>` id, falling back to `quickCapture[].ts`, then
  `project.createdAt`). It returns `{ ..., dates }` alongside the manifest.
- Photo manifest entries change `folder` from `photos` to the dated damage
  folder; `map.png`, `plan.png`, `pins.csv`, `quick-capture/*` get the `MISC
  <date>/` prefix; `pinlog.pdf` becomes `<dated folder>/picture-map.pdf`.
- Each manifest item carries a `date`; `_addPhotosToZip()` and `_addMetaToZip()`
  pass `{ date }` to `JSZip.file()` so the entry's DOS timestamp is the capture
  time.
- The parts export and the cloud manifest reuse the same names automatically,
  since both already build from `collectExportItems()`.
- The `/get` download page needs no change — it rebuilds from the manifest's
  `zipPath` values.
- Export sheet help text is updated to describe the new folder names.

Nothing changes in pins, capture, photo quality, the PDF layout, CSV columns, or
the size/parts logic.
