## Goal
Restore usability by moving off pure monochrome. Keep the calm, professional PGG feel — but add enough contrast, depth, and a warm accent so the plan canvas, pins, buttons, and status chips are easy to read at a glance in the field.

## The rebalanced palette

**App chrome (screens outside the plan)** — soft warm off-white, not stark white:
- `--bg` (screen background): `#f7f5f2` (warm paper)
- `--paper` (cards, sheets): `#ffffff`
- `--line` (borders): `#dcd6cc` (a touch warmer than gray)

**Plan canvas** — light neutral gray so pins and the plan image both pop:
- Canvas background: `#e8e6e2` (light warm gray, not white, not dark)
- This is the biggest legibility win: white plan-on-white canvas washed everything out; a gray frame makes the plan itself the brightest thing on screen.

**Text**:
- `--ink` (primary text): `#1f1b16` (near-black, warm)
- `--muted` (secondary): `#6b6357`

**Accent (warm brown, kept)**:
- `--accent`: `#8b5e34`
- `--accent-soft`: `#efe5d6` (used sparingly — icon chip, active tab)

**Status colors brought back (muted, not candy)** — needed so "not exported" vs "exported" and pin markers actually register:
- Warn (not-exported badge, export reminder): amber `#b8801a` on `#fdf4e0`
- OK (exported badge): green `#2f7d4f` on `#e4efe4`
- Pin fill on plan + exported PNG: `#8b5e34` (accent brown) — high contrast on the gray canvas

## What changes on screen

1. Home / Recent / Setup screens: subtle warm off-white background instead of glaring white; cards stay white so they lift off the page.
2. Plan work screen: canvas becomes light gray → plan image and brown numbered pins read clearly.
3. Export-reminder banner: readable amber again (was gray-on-gray).
4. "Not exported" / "Exported" chips: amber and green again, muted tones.
5. Edit-pin pill (top-left), buttons, and the pin sheet keep the brown accent for primary actions.
6. Zero layout/structural changes — pure CSS token swap in the `:root` block plus the canvas background and two badge rules.

## Out of scope
- No new features, no removed features.
- No font changes.
- No changes to export ZIP structure or CSV.

## Technical notes
- All edits live in the `:root` block (lines ~118–123 of `public/survey.html`), the `.ri-badge.warn` / `.ri-badge.ok` rules, the `.export-reminder` rule, and the canvas background rule.
- `pinFill` in the plan renderer stays `#8b5e34` so exports match the on-screen pin color.
