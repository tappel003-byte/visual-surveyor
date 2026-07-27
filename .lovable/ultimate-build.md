# Ultimate Build — Vision

The long-term shape of the app. Current shipped version stays as-is (photo pins
+ drawing). This doc captures where we're going so we can phase into it.

## Core model

A **finding** is one record with optional facets:

```
{ id, location, number?, photos?, symbol?, drawing? }
```

Every mode just decides which facets a tap captures. Drawing was never a
separate app — it's one facet of a finding. That's why it's "already done."

## The three modes

Mode = what a tap on the plan does. The **active toolbar IS the mode
indicator** — no separate banner or pill needed.

- **Photo mode** — tap drops a numbered pin, opens the photo/description dialog.
- **Symbol mode** — tap stamps the currently selected symbol on the plan.
  No pin number, no photo, no dialog. Pure visual diagram.
- **Draw mode** — freehand on the plan. Squiggles, slab cracks, arrows.

Switching modes = swapping the visible toolbar (from the `⋯` overflow menu).
One tap, the toolbar swaps, done.

**Invariant:** the active toolbar is always visible. It can be dragged, but
not dismissed without switching to another mode. Something on screen always
tells you what tap does.

## Symbols

One symbol per finding type. The damage is what matters; "diagonal" etc. are
descriptors handled elsewhere (color/notes), not separate symbols.

Initial set (small on purpose — not as many as you'd think):

- Drywall crack
- Ceiling crack
- Slab crack
- Stairstep crack
- Stem wall crack
- Door pinch
- Window pinch / opening
- Ghost door
- Pinched door

Color already encodes severity/category, so we don't need diagonal variants.
Symbols can be added to existing photo pins after the fact ("I can always go
back and add symbols later").

## Toggle: symbol vs pin number

While working, a toggle controls what's rendered on the plan:

- Show pin numbers only
- Show symbols only
- Show both

Doesn't change the data — just the display. Useful when reviewing or
presenting a clean diagram.

## Exports

Two outputs from the same project:

1. **Symbol map** — the plan with symbols (and optional drawings), no pin
   numbers. The damage diagram for the engineer.
2. **Picture location map** — the plan with numbered pins keyed to the photo
   log. The reference for the report.

## Why this is the right shape

The job varies. Not every house needs the full treatment.

- Small job: photo mode only, 20-minute log, done.
- Engineer needs a damage diagram: symbol mode + draw mode, no photos required.
- Litigation house: all three modes layered on the same plan, full export.
- External elevations: symbols only, fast.

Before: one workflow, bent to fit small jobs and bent again to fit big ones.
After: a toolkit; pick what this job needs.

## Phasing

1. **Phase 1 — Photo mode.** (Shipped.) Pins, photos, descriptions, CSV.
2. **Phase 1.5 — Drawing.** (Shipped.) Freehand on the plan.
3. **Phase 2 — Photo + symbol.** Add an optional symbol to a photo pin.
   Symbol library + picker in the existing pin dialog.
4. **Phase 3 — Symbol-only mode.** Tap-to-stamp without a pin/dialog.
   Toolbar switch via `⋯`. Display toggle (numbers / symbols / both).
5. **Phase 4 — Unified.** All three modes coexist on one plan, with the
   two-export pipeline (symbol map + picture location map).

Drawing is already in, so Phase 4 is mostly wiring exports and the display
toggle — not a new mode build.

## Open questions (defer)

- Symbol picker UX: scrollable strip vs. grid popover.
- Per-symbol color override vs. global severity coloring.
- Whether symbol-only stamps should still be selectable/editable post-tap
  (probably yes, lightweight: tap to delete / replace).
