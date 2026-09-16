# Simplify the Export sheet

Strip the export sheet down to the buttons — coworkers don't need the inventory of what's inside the ZIP.

## Changes (all in the Export sheet markup in `public/survey.html`, lines ~883–931, plus two button-label reset strings)

1. **Delete the "Final deliverable" block** (lines 911–916) — the whole bullet list describing the dated folder, `misc/`, survey-date and front-door notes. Gone entirely.

2. **Rename the PDF preview button** — `📄 Preview PDF (Plan + Pin Log)` becomes **📄 Preview Picture Map**. Its one-line subtext becomes: "Opens the picture map in a new tab so you can review before saving. The same file is inside the ZIP."

3. **Clarify the desktop export** — button keeps `💾 Move to Desktop (project file)`; its subtext becomes: "Saves a file you can open on your desktop to keep working on this job there." (Drops the `.pgg` jargon and "Not a client deliverable".)

4. **Update the two label-reset strings in JS** (lines ~7201, ~7265) so the buttons return to the new labels after an export finishes instead of the old ones.

## Kept as-is

- The **Finish & Export (ZIP)** button, size readout, Shrink button, cloud upload button and its short note.
- Everything the ZIP actually contains — only the on-screen description changes.
- All other sheets, pins, capture, and export logic.

## Technical details

- Edits are confined to the `#exportBody` block plus the two `btn.innerHTML` reset strings in `exportProjectPdf()` / `exportProjectFile()`.
