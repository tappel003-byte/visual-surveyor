# Close export automatically when finished

## Change

In `public/survey.html`, update the multipart export completion path so that after all ZIP parts are successfully shared or downloaded it immediately:

1. Records the export as complete.
2. Closes the export progress panel.
3. Closes any remaining export sheet/scrim.
4. Returns to the normal project screen without requiring a final **Done** tap.

Keep the panel open only when the user cancels the share sheet, when a part fails, or when the export is paused so the available retry/fallback actions are not lost.

## Scope

No changes to ZIP contents, part size, photo handling, Mail Drop sharing, fallback downloads, pins, or project data.
