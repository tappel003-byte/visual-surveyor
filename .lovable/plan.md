## Clean-out pass

Three visible things gone, one confusion cleared up.

### 1. Empty cream pill (top-left of plan)
Remove the `.mode-pill` `<div>` in the work screen. Both buttons inside are already hidden — the container itself is what shows as the little dot.

Nothing else needs to move into that corner — with no drawing tool left, the corner should just be empty. If you later want something there (a mode toggle, a room-label toggle, etc.) we add it deliberately.

### 2. Interior / Exterior selector in the pin sheet
Currently hidden by inline style, but JS at line 3687 sets `display = ''` whenever a non-external project opens a pin — that's why it's back in your screenshot. Fix:
- Delete the `#intExtRow` markup entirely.
- Delete the line that sets its display.
- Leave `p.isExterior` field alone in the data model (harmless; already defaults to Interior/red).

### 3. Photo Annotate pen (inside the full-screen photo viewer)
When you tap a photo to view it, there's an ✏️ Annotate button that opens a drawing toolbar over the photo. Remove:
- The ✏️ Annotate button.
- The annotate-mode toolbar (Cancel / Undo / Save).
- The text-annotation editor modal.

Leave the underlying JS in place (no callers = no risk); strip only the visible entry points.

### Verification
- Search: `intExtRow`, `pv-annotate`, `mode-pill` in survey.html — should show only defensive JS references, no visible DOM.
- Open a pin: no Interior/Exterior bar.
- Tap a photo: no ✏️ Annotate button.
- Top-left of plan: clean, no cream dot.
