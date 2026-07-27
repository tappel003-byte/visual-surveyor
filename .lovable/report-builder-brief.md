# Report Builder — Project Brief

A standalone web app that turns a Field Reporter export into a formatted,
editable distress-survey report. Built as its own Lovable project — **do not
build into the field app**. This file is a brief to drop into a new project
so the agent there has full context.

---

## What it is

A desk-side report assembler. You feed it the ZIP the field app produces
(plan PNG/PDF + numbered photos + `pins.csv`), and it gives you a structured
report draft with AI-cleaned descriptions, photo tables, and rearrangeable
sections. You polish it in-app, then copy-paste or export into your final
deliverable (Word, Google Docs, PPT — wherever the engineer's report lives).

Think: the field app captures, the Sorter organizes after-the-fact phone
photos, and this tool turns either of their outputs into a document.

## Who uses it

The same engineer/inspector who uses the Field Reporter PWA. Workflow:
1. Finish a survey in the field app (or the Sorter). Hit Export — get a ZIP.
2. Open Report Builder in a browser at the desk. Drop the ZIP in.
3. Tool unpacks it, runs AI cleanup on each photo's description (fixes
   dictation errors, normalizes terminology, keeps the engineer's voice).
4. Engineer reviews each row, edits where AI got it wrong, reorders sections,
   merges/splits pins, drags photos between rows if needed.
5. Copy the rendered report into Word/Docs, or export to DOCX/PDF.

## Core principles

- **Input contract = Field Reporter export.** Do not invent a new format.
  Read the ZIP shape the field app already produces: `plan.png` (or PDF),
  `photo-01.jpg…photo-NN.jpg`, `pins.csv` with `Location, Type, Description,
  Photo Count, Photo Numbers`. The Sorter produces the same shape.
- **AI assists, never decides.** Every AI-cleaned description sits next to
  the raw original with a one-click revert. The engineer's edits always win.
  Never auto-publish an AI-only field.
- **Editable everywhere.** Every description, heading, caption, and section
  title is inline-editable. Drag handles on every row and section.
- **Copy-paste is a first-class export.** Engineer should be able to select
  the whole report, Cmd-C, paste into Word, and have tables/headings survive.
  DOCX/PDF export is a bonus, not the only path out.
- **No login, no cloud, no backend persistence required for v1.** Work lives
  in the browser tab; "Save Project" downloads a `.report.json` they can
  reopen later. (Lovable Cloud + accounts is a fast-follow if asked.)

## UX shape

Desktop-first (engineers do this at a desk), responsive enough not to break
on tablet.

- **Home / import screen.** Big drop zone: "Drop Field Reporter ZIP here."
  Also: "Open existing .report.json". Recent projects list.
- **Main workspace** (three-pane, desktop ~1440px+):
  - **Left: outline.** Cover, Summary, Findings (one entry per pin),
    Appendix. Drag to reorder. Click to jump.
  - **Center: report canvas.** The actual rendered report. Headings,
    paragraphs, photo tables, captions. Inline-editable. This is what
    gets copy-pasted out.
  - **Right: inspector.** When a finding row is selected: raw description,
    AI-cleaned description (editable), photo thumbnails (reorderable,
    removable), pin location/type, AI re-run button.
- **Finding row default layout:** heading ("Location 4 — Interior wall
  crack"), 1–2 paragraphs of cleaned description, table or grid of the
  pin's photos with auto-captions ("Photo 4", "Photo 5", "Photo 6").
- **Section types** (insertable from a `+` menu between sections):
  - Cover (title, address, date, engineer name)
  - Free-text section (intro, methodology, conclusions)
  - Findings group (auto-populated from pins; one row per pin)
  - Photo grid (manual selection of photos for an overview)
  - Page break marker (hint for DOCX/PDF export)
- **Bulk actions:** "Re-run AI cleanup on all", "Reset all to raw",
  "Group findings by Type / by Location / flat".

## AI cleanup contract

- Model: Lovable AI Gateway, default `google/gemini-3-flash-preview` (cheap,
  fast, plenty for description normalization). Bump to `gemini-2.5-pro` only
  on user request.
- Prompt is a single system message + the raw description. System prompt
  enforces: keep engineer's voice, expand obvious dictation errors, normalize
  terminology (e.g. "stair step" → "stairstep crack"), do NOT add facts not
  present in the input, do NOT speculate severity or cause.
- Output is plain text, max ~3 sentences per finding by default. The user
  can override length per row.
- All AI calls run server-side via a TanStack server function. Never expose
  `LOVABLE_API_KEY` to the browser. Show a clear error on 402 (credits) or
  429 (rate limit).

## Export

Three paths, in priority order:
1. **Copy-paste** — select-all on the canvas yields HTML that pastes cleanly
   into Word and Google Docs (tables intact, headings intact, images
   embedded as base64 data URLs in the clipboard).
2. **DOCX** — `docx` npm package, generated server-side. Tables, headings,
   embedded images, page breaks honored.
3. **PDF** — print-stylesheet for now; native PDF generation later.

Also: **"Save Project"** downloads `<address>.report.json` containing the
whole editable state (pins, edits, section order, photo refs). Re-opening
it restores the workspace.

## Photo handling

- ZIP photos are extracted in-browser (JSZip) and held as Blob URLs for
  display. The original photo bytes also get embedded into DOCX/PDF exports
  and into the saved `.report.json` (base64) so projects are self-contained.
- Photo numbering stays the field app's convention: global `photo-NN.jpg`,
  with pin #N owning photos starting at N. Don't renumber on import.

## Tech notes for the new project

- TanStack Start (Lovable modern stack default). React 19, Vite 7, Tailwind
  v4. Single primary route `/`, plus a project route `/p/$projectId` once
  Save Project lands.
- AI calls via `createServerFn` in `src/lib/cleanup.functions.ts`. Use the
  Lovable AI Gateway pattern (see `connecting-to-ai-models-tanstack`). No
  Edge Functions, no Supabase needed for v1.
- ZIP parsing: `jszip` client-side.
- DOCX export: `docx` npm package, invoked from a server function so the
  Node-only bits aren't bundled into the browser.
- State: Zustand or `useReducer` — a single normalized store keyed by pin
  id makes drag/reorder/edit trivial. Persist to localStorage as a
  draft-recovery safety net.
- No Lovable Cloud, no auth, no database for v1. Add later only on request.

## Explicitly NOT in scope (v1)

- Multi-user collaboration / sharing links
- Account system, cloud sync
- Re-capturing photos in-app (that's the field app)
- Editing/cropping/rotating photos (use the OS tools)
- Severity scoring or engineering judgment by AI
- Symbols, drawings, or anything that mutates the plan (read-only here)
- Multi-survey projects (one ZIP = one report in v1)

## Naming

Working name: **Report Builder**. Other candidates: Survey Report, Findings
Studio, Draft. Pick at project creation.

## Relationship to other projects

- **Field Reporter PWA** (phone, in-the-field capture) — sibling, produces
  the ZIP this tool consumes.
- **Survey Sorter** (desktop, post-hoc photo placement) — sibling, produces
  the same ZIP shape; this tool consumes its output too.
- **Homeowner intake tool** (phone, public-facing) — sibling, unrelated
  workflow.

Four sibling tools. Same engineer, four contexts: capture, organize,
report, intake.
