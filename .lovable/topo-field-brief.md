# Topo Field — Project Brief

## What I'm building
A desktop web app that replaces the only 3 things I actually use in 3-D Field (a legacy Windows topo program) for residential foundation/settlement surveys.

The app turns a floor plan image + a handful of elevation readings into a colored contour map I can screenshot into a PowerPoint report.

## Who uses it
Just me — a forensic foundation/structural consultant. Desktop only (Chrome/Edge). No mobile, no multi-user, no auth needed for v1.

## The core workflow (this is the whole app)
1. **Upload a floor plan image** (JPG/PNG/PDF page) onto a big canvas
2. **Draw a boundary polygon** around the exterior walls — click to place vertices, double-click or Enter to close. This polygon defines where contour lines get drawn (no contours outside the house).
3. **Drop elevation points** — click anywhere on the plan, a small dialog asks for the elevation value (decimal inches, e.g. `-0.45`, `0.0`, `+0.30`), Enter to save.
4. **Press "Generate Topo"** → colored contour lines appear inside the boundary, interpolated from the points.
5. **Export PNG** sized to drop cleanly into a PowerPoint slide.

That's v1. Don't over-build.

## Editing / project state
- Click a point to edit its elevation or delete it
- Drag a point to move it
- Edit/delete boundary vertices
- Save projects locally (IndexedDB) — list of saved jobs on the home screen, click to reopen
- Auto-save as I work

## Contour settings (simple panel)
- Contour interval: dropdown (0.1", 0.25", 0.5", 1.0") — default 0.25"
- Color ramp: blue (low) → green → yellow → red (high). Reversible.
- Show/hide elevation labels on contour lines
- Show/hide the original points (with their values) on top of the contours
- Line thickness slider

## The math (the easy part — don't get fancy)
- Delaunay triangulation of the elevation points
- Linear interpolation across triangles to build a grid
- Marching squares to extract contour polylines at each interval
- Clip everything to the boundary polygon
- Render to canvas

A JS library like `d3-delaunay` + `d3-contour` handles 90% of this. Don't roll it from scratch unless you have to.

## v2 (do NOT build in v1 — just leave hooks)
- 3D exaggerated terrain view (rotatable, zoomable, vertical exaggeration slider) — this is the "wow the homeowner / wow the attorney" view. Three.js when we get there.
- Export 3D screenshot + short rotating MP4/GIF

## v3 nice-to-haves (mention only)
- DXF export
- Multiple boundaries (interior courtyards/voids)
- CSV import of points
- Annotations (arrows, text labels)

## Design / feel
- Clean desktop app, big canvas, minimal chrome
- Left sidebar: tools (Boundary, Add Point, Edit, Pan, Zoom)
- Right sidebar: contour settings + point list
- Top bar: project name, Save, Export PNG, Generate Topo button
- Dark or light theme — pick one and commit, don't build both yet
- Looks like a focused pro tool, not a generic SaaS dashboard

## Tech notes
- Single-page web app, runs entirely in the browser
- LocalStorage / IndexedDB for project persistence
- No backend needed for v1
- File System Access API optional (nice for "save to folder")

## What I'll send you to start
- 3-4 screenshots of my current 3-D Field workflow (plan + boundary, point entry, finished topo, settings panel)
- A sample dataset: ~15-20 points with X, Y, elevation values from a real job

## Build v1 first. Don't scope-creep. We'll add 3D in v2.
