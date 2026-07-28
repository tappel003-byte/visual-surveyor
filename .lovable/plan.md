## Light monochrome rebrand + Edit pin move

Single file: `public/survey.html`. No functional changes.

### 1. Move Edit pin pill to upper-left
The "Edit pin ▾ (N pins · N pics)" pill currently floats at the bottom of the work screen. Move it to the top-left corner of the plan area (where the removed mode-pill used to sit). Same size, same click behavior, just repositioned.

### 2. Light monochrome theme
- App background: white / near-white (no dark charcoal anywhere)
- Plan canvas: white with a very light gray checker or plain white
- Cards, sheets, buttons: white surfaces with thin light-gray borders and soft shadows for depth
- Text: near-black on white; secondary text in mid-gray
- Accents: grayscale only — no cream, no red, no orange, no dark theme
- Pin marker on the plan: neutral dark dot with white ring + number (no red)
- Buttons: white/light-gray with black text; active states a slightly darker gray
- "Not exported" reminder banner: keep the reminder, restyle to a light neutral (light gray band, no yellow)

### 3. Home card icon
Swap the 🏠 emoji on the "PGG Photo Documentation" home card for a camera icon (📷).

### Out of scope
- No logo/favicon swap yet (you may supply a PGG logo later).
- No changes to canvas mechanics, pins, capture, OCR, room picker, quick capture, or export.
- Header text stays "PGG Photo Documentation".

### Technical notes
- Edit the CSS custom properties block at the top of `<style>` in `survey.html` as the single palette source, then sweep any hardcoded colors on: pin marker, home card background, mode buttons, sheet chrome, "Not exported" banner, and the Edit pin pill.
- Edit-pin pill: change its `position: fixed` bottom coords to top coords (matching the old mode-pill location), keep width/padding/dropdown behavior identical.
