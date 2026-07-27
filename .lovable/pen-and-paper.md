# Pen-and-Paper Version

The digital equivalent of a clipboard + camera + pen. No symbols, no theme
toggle, no multi-mode toolkit. Just the basics, done well.

This is the **buildable target.** The bigger vision lives in
`.lovable/ultimate-build.md` and is explicitly out of scope here.

## Flow

```
Home screen
  ├── Internal Camera  ─┐
  └── External Camera  ─┴──> Setup ──> Work ──> Export
```

### 1. Home screen

Two big buttons:
- **Internal Camera**
- **External Camera**

That's the whole home screen. (Plus a list of existing projects to resume.)

### 2. Setup (same for both modes)

- **Address** — text field. Identifies the project.
- **Floor plan** — upload an image (the plan or elevation drawing).
- **North arrow** — place + rotate on the plan.
- **Starting pin number** — defaults to 1, editable (so you can resume a job
  or continue numbering across multiple plans).

### 3. Work

Same on-plan experience as today's app:

- Tap the plan → drops the next numbered pin, opens dialog for photo +
  description.
- **Drawing tool** — freehand pen for squiggles, slab cracks, arrows.
- Tap an existing pin to edit.

No symbol library. No severity colors. No mode toolbar. The mode was
chosen on the home screen and doesn't change mid-job.

### 4. Export

**Picture map** (both modes get this) — a single document containing:
- Header: address.
- The floor plan image with numbered pins burned in and the north arrow.
- A keyed list of descriptions: `1. <description>`, `2. <description>`, …
  one row per pin, in pin-number order.

Likely format: PDF (plan on first page, description list following). One file.

| Mode | Export |
|---|---|
| **Internal Camera** | Picture map **+** folder of all photo files |
| **External Camera** | Picture map only |

## Explicitly NOT in this version

- Symbol mode / symbol library
- Symbol vs. pin-number display toggle
- Severity colors / categories
- Dark mode / light mode toggle
- Multi-plan-per-project (one plan per project for now)
- CSV / spreadsheet exports beyond the two listed above
- Anything from `ultimate-build.md` not listed in **Flow** above

## What's already shipped vs. what's new

Already shipped: numbered photo pins, drawing tool, photo capture/description.

New for pen-and-paper:
1. Home screen with Internal / External entry points.
2. Address field on the project.
3. North arrow placement + rotation on the plan.
4. Starting-pin-number setting.
5. Two distinct exports keyed off the mode chosen on home (photo folder
   only for Internal; map only for External — map for both).
