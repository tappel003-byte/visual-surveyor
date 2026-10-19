# Tim checklist — Lovable Publish for office File Explorer

Netlify `/office` talks to **Lovable Cloud APIs** with `EXPORTS_LIST_TOKEN`. A Netlify-only deploy is **not** enough when API routes change: Lovable must Publish so `visual-surveyor.lovable.app` serves them.

## After this merge lands on `main`

### 1. Publish once in Lovable (required)

1. Open the **visual-surveyor** project in Lovable.
2. Confirm the latest `main` (or synced) code includes:
   - `GET /api/public/exports-list` (**manifest-light** — no per-job recursive storage walk; `syncedAt` / `syncedFrom` from `manifest.json`)
   - `GET /api/public/exports-job` (unsigned file list — fast Open)
   - `GET /api/public/exports-sign` (lazy signed URL on click)
   - `POST /api/public/exports-delete` (**new** — delete job folder)
   - `POST /api/public/exports-from` (**new** — write From into manifest)
3. Click **Publish** (one publish is enough).
4. Optional smoke (without Bearer → **401**, not a site 404):
   - `…/api/public/exports-job`
   - `…/api/public/exports-sign`
   - `…/api/public/exports-delete`
   - `…/api/public/exports-from`

### 2. Wait for Netlify production (the one merge)

1. Wait for the single production deploy of the merge on Netlify (www).
2. Do **not** ask Netlify to set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm Netlify already has only:
   - `NLF_OFFICE_PASSWORD`
   - `NLF_SESSION_SECRET`
   - `EXPORTS_LIST_TOKEN` (same value as Lovable)

### 3. Try office File Explorer

1. Open [www/office](https://www.pggphotodocumentation.com/office)
2. Sign in — Windows-style sidebar + toolbar (Open / Download / Delete / From… / Refresh)
3. Confirm **From** always shows (nickname, office label, or **Unknown**)
4. Edit From on an old job → Refresh → label sticks
5. Open a large job — page appears quickly; click a photo to load
6. Delete with confirm → job leaves the list
7. Field: enable Auto-sync once; leave a job online → staging updates after Refresh

## What not to do

- Do **not** put `SUPABASE_SERVICE_ROLE_KEY` on Netlify.
- Do **not** re-add `SUPABASE_URL` to Netlify (secret scan can fail the build).
- Signing / delete / From write-back stay on Lovable; Netlify only uses `EXPORTS_LIST_TOKEN`.
