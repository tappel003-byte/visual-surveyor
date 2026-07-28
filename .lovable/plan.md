## Two export buttons + on-device review

Both options exist — nothing forces a choice.

### Export sheet gets two buttons

1. **Finish & Export** — the current deliverable ZIP (plan PNG with pins, CSV, photos folder, 11×17 PDF). Unchanged from today.
2. **Move to Desktop** — a re-openable project file containing `project.json` (pins, coords, rooms, notes, settings) plus the original photo blobs. Opens on any device running this app via a new **Import** button on the home screen.

Projects stay on the device until you delete them manually — exporting either kind does not remove anything.

### Review before export

New **Review** button on the export sheet (and a soft prompt before Finish & Export runs). Opens a scrollable list of every pin: Pin # · Photo range · Location · Notes. Tap any row to edit location or notes inline. Uses the browser's native spell-check on the textareas. Close the review and hit Finish & Export when it reads clean.

Review is optional — you can skip straight to either export button.

### Home screen

Adds an **Import project file** action alongside the existing project list. Picks a `.pgg` (zip) file, restores the project, drops you into it.

Duplicate handling: if the address already exists, the imported one comes in as "<address> (v2)". No prompts.

### Technical notes

- `.pgg` = a `.zip` (JSZip, already loaded) with `project.json` + `photos/photo-NN.jpg`. Version field for future migrations.
- Import path reuses existing IndexedDB writers; no schema change needed for the app itself.
- Review screen is a new modal in `survey.html`, reads/writes the same in-memory project object the pin sheet uses.
- No changes to canvas, pin drop, quick capture, or the current ZIP export contents.
