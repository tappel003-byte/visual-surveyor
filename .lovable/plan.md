## Fully remove voice memo feature from `public/survey.html`

Delete rather than hide. All changes are in one file.

### What gets removed
1. **UI markup**
   - 🎙️ voice memo button in the main toolbar
   - Voice memo entry in the ⋯ overflow menu
   - Voice memo list/section in the pin sheet (if present)
   - Any recording-indicator DOM (red dot, timer)

2. **JS functions and handlers**
   - `toggleVoiceMemo`, start/stop recording, MediaRecorder setup
   - `vm_*` IndexedDB read/write/delete helpers
   - Blob-URL playback helpers used only by voice memos

3. **Export path**
   - `voice-memos/` folder block in ZIP export
   - Voice memo CSV column / notes append
   - Any `project.voiceMemos` iteration during export

4. **Data model**
   - Stop initializing `project.voiceMemos = []` on new projects
   - Leave old projects' `voiceMemos` field alone (ignored, no migration)

### What stays untouched
- Photo capture, pins, notes, room picker, OCR, Quick Capture, ZIP export (plan+pins image, CSV, photos folder), clear-drawings menu item, delete-project, PWA/offline shell.

### Verification after edit
- Search the file for `voiceMemo`, `vm_`, `MediaRecorder`, `🎙` — should return zero hits.
- Confirm export still produces plan image + `pins.csv` + `photos/` for a project with pins.
- Confirm Quick Capture folder + CSV still emit.
