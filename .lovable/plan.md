# Rename the export folders

## New layout

Today a job unzips like this:

```text
1234-main-st/
  photos/
  quick-capture/
  map.png
  plan.png
  pins.csv
  pinlog.pdf
```

After this change:

```text
1234-main-st/
  5821_2026-08-26/
    photo-01.jpg ...
    quick-01.jpg ...
    quick-capture.csv
    picture map.pdf
  misc/
    map.png
    plan.png
    pins.csv
```

- The photos folder is renamed **job number _ survey date**.
- **pinlog.pdf** is renamed **picture map.pdf** and lives inside that folder.
- Quick-capture photos and their CSV move into that folder too — no separate
  quick-capture folder. Filenames stay `quick-01.jpg` etc. so they sort after
  the numbered photos.
- The map, plan and pins CSV go into a folder called **misc**.

## Details to settle by defaulting

- **Date** — `YYYY-MM-DD` so folders sort correctly. It's the date of the
  earliest photo in the job (the day the survey was walked). A job with no
  photos uses the day the job was created.
- **No job number entered** — the folder is just the date
  (`2026-08-26_damage`→ no; simply `2026-08-26`). Add the job number on the
  setup screen and it appears next time you export.

Say the word if you'd rather the PDF be `picture-map.pdf` (hyphen) or the misc
folder be `MISC` in caps — both are one-word changes.

## Technical notes

All in `public/survey.html`, inside `collectExportItems()`:

- Add a survey-date helper: earliest photo timestamp decoded from the
  `ph_<base36>` photo id, falling back to `quickCapture[].ts`, then
  `project.createdAt`.
- Photo manifest entries change `folder` from `photos`/`quick-capture` to the
  single dated folder; `map.png`, `plan.png`, `pins.csv` get a `misc/` prefix;
  `quick-capture.csv` and the PDF move into the dated folder, the PDF renamed.
- The parts export, the cloud manifest and the `/get` download page all build
  from `collectExportItems()`, so they pick the new names up automatically.
- Export sheet help text updated to describe the new folder names.

Nothing changes in pins, capture, photo quality, the PDF layout, CSV columns,
or the size/parts logic.
