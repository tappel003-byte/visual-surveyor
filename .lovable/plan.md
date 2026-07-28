## Add a warm brown accent

Keep the current light/white monochrome base — just reintroduce a single brown accent so pins, active states, and small highlights read clearly.

### Palette change (`public/survey.html`, `:root` block only)
- `--accent`: `#8b5e34` (warm saddle brown) — used by pin markers, active tool buttons, focus rings, primary highlights
- `--accent-soft`: `#f2e8dc` (light tan) — used by soft backgrounds (home card icon tile, active room chip, hover states, reminder banner)
- `--bg`, `--paper`: stay white
- `--ink`, `--muted`, `--line`: stay neutral grays
- Export pin fill in the plan-image renderer: switch from dark gray back to `#8b5e34` so the exported PNG matches the on-screen brown pins

### Out of scope
- No layout changes, no functional changes, no logo work.
- Edit-pin pill stays in the upper-left.
- Home card icon stays 📷.

If you'd rather have a darker chocolate brown (`#5c3a21`) or a lighter tan (`#a97c50`), say the word before I build — otherwise I'll ship `#8b5e34`.
