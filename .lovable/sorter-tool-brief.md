# Survey Sorter — Project Brief

A standalone desktop companion to the field-survey PWA. Built as its own
Lovable project — **do not build into the field app**. This file is a brief
to drop into a new project so the agent there has full context.

---

## What it is

A desktop-only web app for placing already-taken photos onto a floor plan
**after the fact**, at a desk, with a keyboard. The field app is for
capturing in the crawlspace; this is for organizing what you captured.

Think Lightroom to the field app's camera. Same "negatives" (photos +
plan), different tool.

## Who uses it

The same engineer/inspector who uses the field-survey PWA. Workflow:
1. Walk the house, take 50–200 photos freely with the phone camera (no app).
2. Get back to the desk with a folder of `IMG_1002.jpg` … `IMG_1198.jpg`
   and a floor plan image/PDF the client emailed over.
3. Open the Sorter, point it at the folder, drag photos onto the plan,
   type descriptions with a real keyboard.
4. Export: same format the field app produces (annotated plan + numbered
   photo folder + descriptions CSV).

## Core principles

- **Desktop-only.** Chrome/Edge required (File System Access API). On
  mobile/Safari/Firefox: show "Use Chrome on a desktop" message, do not
  attempt a fallback flow.
- **Folder-based, no upload, no cloud, no auth, no backend.** Photos
  live on the user's disk. The app reads/writes that folder directly via
  File System Access API. The "project" IS the folder.
- **Rename in place on export.** `IMG_1108.jpg` literally becomes
  `001.jpg` (or `photo-001.jpg` — match field app convention) on disk.
  Same bytes, new filename. Multi-photo pin → consecutive numbers
  (pin #1 with 3 photos → `001/002/003`, pin #2 → `004/005`).
- **Non-destructive by default.** Default: write renamed copies to an
  `/export` subfolder, leave originals untouched. Checkbox: "also delete
  originals when done." Destructive only on explicit opt-in.
- **Interop with field app.** Same export shape: annotated plan PDF,
  `photos/` folder of numbered JPEGs, `descriptions.csv`. A project
  produced by either tool should be openable/extendable by the other if
  feasible.

## UX shape

- **Home / project picker.** "Open folder" button (File System Access
  picker). Recent folders list. New project = "open folder + pick plan
  image."
- **Main workspace** (desktop layout, ~1440px+):
  - **Plan canvas** (center, largest area). Floor plan image, pannable/
    zoomable. Pins render as numbered circles like the field app.
  - **Tray** (right side, ~280px wide, scrollable). Thumbnails of every
    photo in the folder that hasn't been placed yet. Original filename
    shown small under each.
  - **Pin inspector** (right side, replaces tray when a pin is selected
    or being created). Shows attached photos, description textarea
    (keyboard-focused on open), delete pin button.
- **Drag-and-drop interactions:**
  - Drag thumbnail from tray → drop on empty plan area = create new pin
    there with that photo. Inspector opens, description field focused.
  - Drag thumbnail → drop on existing pin = add photo to that pin.
  - Drag thumbnail back to tray = unplace (returns to unplaced pool).
- **Keyboard:** Tab moves between description fields; Enter saves and
  returns focus to tray; arrow keys to cycle pins; Delete to remove
  selected pin.
- **Pins hold multiple photos**, same as field app's internal mode.

## Photo numbering rule (match field app)

Pin number = location AND starting photo number. Pin #4 with 3 photos →
photos 4, 5, 6. Numbering is global across the project, sequential by
pin order on the plan.

Original capture order / EXIF time is irrelevant for numbering — placement
order on the plan drives the final numbers. (Optional: write a sidecar
`original-filenames.csv` mapping `001.jpg → IMG_1108.jpg` for traceability.)

## Project state persistence

A small `.sortproject.json` written into the folder itself. Reopen the
folder → state restored (pin positions, descriptions, plan image
reference, photo assignments). No cloud sync, no accounts.

## Export

One button. Writes to `/export` subfolder of the project folder:
- `plan.pdf` — floor plan with numbered pins burned in
- `photos/001.jpg`, `002.jpg`, … — renamed copies (or moved originals
  if destructive mode)
- `descriptions.csv` — `pin_number, photos, description`
- (Optional) `original-filenames.csv` — traceability mapping

## Tech notes for the new project

- Single-page web app. React or vanilla — agent's call, but vanilla +
  one HTML file (like the field app) is appealing for offline simplicity.
- **File System Access API** is the whole point. `showDirectoryPicker()`,
  `FileSystemDirectoryHandle`, `getFileHandle({ create: true })`,
  `createWritable()`. Persist handles via IndexedDB so reopening a
  recent project doesn't re-prompt.
- PDF generation: `pdf-lib` or `jspdf` (same as field app — check what
  it uses and match for consistency).
- No backend, no Lovable Cloud, no auth. Pure client-side.
- Chrome/Edge only. Feature-detect `window.showDirectoryPicker` on
  load; if missing, show a friendly "this app needs Chrome or Edge on
  a desktop" screen and stop.

## Explicitly NOT in scope

- Mobile/tablet layout (desktop-only on purpose)
- Cloud sync, accounts, sharing links
- Taking photos in-app (that's the field app's job)
- Symbols, drawing, severity colors (keep this tool focused — just
  place photos and type descriptions)
- Multi-plan projects (one plan per folder for v1)
- Editing/cropping/rotating photos

## Naming

Working name: **Survey Sorter**. Other candidates: Place, Catalog,
Studio. Pick at project creation.

## Relationship to other projects

- **Field-survey PWA** (phone, in-the-field capture) — sibling, produces
  the photo + plan inputs this tool consumes.
- **Homeowner intake tool** (phone, public-facing) — sibling, separate
  project, unrelated workflow.

Three sibling tools. Same engineer, three contexts.
