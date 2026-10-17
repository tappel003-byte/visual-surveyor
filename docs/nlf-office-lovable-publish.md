# Tim checklist — Lovable Publish for office File Explorer

Netlify `/office` talks to **Lovable Cloud APIs** with `EXPORTS_LIST_TOKEN`. A Netlify-only deploy is **not** enough when API routes change: Lovable must Publish so `visual-surveyor.lovable.app` serves them.

## After this merge lands on `main`

### 1. Publish once in Lovable (required)

1. Open the **visual-surveyor** project in Lovable.
2. Confirm the latest `main` (or synced) code includes:
   - `GET /api/public/exports-list` (now returns `syncedAt` / `syncedFrom`)
   - `GET /api/public/exports-job` (unsigned file list — fast Open)
   - `GET /api/public/exports-sign` (**new** — lazy signed URL on click)
3. Click **Publish** (one publish is enough).
4. Optional smoke (without Bearer → **401**, not a site 404):
   - `https://visual-surveyor.lovable.app/api/public/exports-job`
   - `https://visual-surveyor.lovable.app/api/public/exports-sign`

### 2. Wait for Netlify production (the one merge)

1. Wait for the single production deploy of the merge on Netlify (www).
2. Do **not** ask Netlify to set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm Netlify already has only:
   - `NLF_OFFICE_PASSWORD`
   - `NLF_SESSION_SECRET`
   - `EXPORTS_LIST_TOKEN` (same value as Lovable)

### 3. Try office File Explorer

1. Open [www/office](https://www.pggphotodocumentation.com/office)
2. Sign in with the office password
3. Confirm the job list loads with **Date** (last synced) and **From** (device nickname when synced)
4. Confirm each row has **Open** and **Download**
5. Click **Open** on a large job — page should appear quickly; click a photo to load (lazy sign)
6. Sync from a phone after setting the nickname once → **From** shows that name

## What not to do

- Do **not** put `SUPABASE_SERVICE_ROLE_KEY` on Netlify.
- Do **not** re-add `SUPABASE_URL` to Netlify (secret scan can fail the build).
- Do **not** expect Netlify UI alone to mint signed storage URLs — signing stays on Lovable via `exports-sign`.
