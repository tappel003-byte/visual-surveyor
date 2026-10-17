# Tim checklist — Lovable Publish for office Open

Netlify `/office` talks to **Lovable Cloud APIs** with `EXPORTS_LIST_TOKEN`. A Netlify-only deploy is **not** enough when a new API route is added: Lovable must Publish so `visual-surveyor.lovable.app` serves that route.

## After this merge lands on `main`

### 1. Publish once in Lovable (required for Open)

1. Open the **visual-surveyor** project in Lovable.
2. Confirm the latest `main` (or synced) code includes `GET /api/public/exports-job`.
3. Click **Publish** (one publish is enough).
4. Confirm the endpoint exists (optional smoke):  
   `https://visual-surveyor.lovable.app/api/public/exports-job`  
   Without a Bearer token it should return **401 Unauthorized** (not a generic site 404).

### 2. Wait for Netlify production (the one merge)

1. Wait for the single production deploy of the merge on Netlify (www).
2. Do **not** ask Netlify to set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm Netlify already has only:
   - `NLF_OFFICE_PASSWORD`
   - `NLF_SESSION_SECRET`
   - `EXPORTS_LIST_TOKEN` (same value as Lovable)

### 3. Try office Open

1. Open [www/office](https://www.pggphotodocumentation.com/office)
2. Sign in with the office password
3. Confirm the job list loads (from Lovable `exports-list`)
4. Click **Open** on a job (e.g. Aspiration) — File Explorer with per-file links should load (from Lovable `exports-job`)

## What not to do

- Do **not** put `SUPABASE_SERVICE_ROLE_KEY` on Netlify (not available from Lovable Cloud for that purpose).
- Do **not** re-add `SUPABASE_URL` to Netlify (secret scan can fail the build).
- Do **not** expect Netlify UI alone to mint signed storage URLs — signing stays on Lovable.
