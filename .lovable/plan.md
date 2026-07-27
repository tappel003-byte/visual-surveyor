# Export reminder for individual project exports

Add a lightweight reminder system so users know which projects still need exporting. No bulk-export feature.

## 1. Track last export per project

- Add optional `lastExportedAt` (ms) to each project object.
- In `exportProjectZip()`, on successful ZIP download, set `project.lastExportedAt = Date.now()` and persist — **do not** bump `updatedAt` (an export isn't an edit).
- Backwards compatible: missing field = never exported.

## 2. Home screen status badge (per project)

In `renderHome()`, next to each recent item, show one of three pill badges (same visual language as Floor Survey):

- **"Not exported"** (amber) — no `lastExportedAt`
- **"Unsaved changes"** (amber) — `updatedAt > lastExportedAt + 1s` tolerance
- **"Exported {relTime}"** (green) — otherwise

## 3. Soft reminder banner on app open

- On `renderHome()`, if any project shows "Unsaved changes" or "Not exported" AND it's been ≥ 7 days since the last export event on that project, show a small dismissible banner above the recent list:
  > "You have {N} project(s) not yet backed up. Tap a project to export it."
- Dismiss stores a `remindDismissedAt` in localStorage, suppressing the banner for 3 days.

## Out of scope

- No bulk export.
- No changes to ZIP contents, photo storage, service worker, or update-app link.

## Technical notes

- All work in `public/survey.html` (vanilla JS, matches project's single-file convention).
- New field `lastExportedAt` is additive on the existing `store.projects[]` shape in localStorage.
