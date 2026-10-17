# NLF office explorer — Netlify environment

Password-gated **office File Explorer** at `/office` on the same Netlify site as the field app. No custom domain required.

## Stage A — office login

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Single shared company password for the office File Explorer (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) used to sign the HttpOnly session cookie. |

## Stage B — job folder list (Supabase storage, server-only)

The signed-in explorer lists synced job folders by reading the shared `exports` storage bucket on **Netlify only** (never from client code or `VITE_*` variables). Recursive file counts use manifest data when present.

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (same as field app / Export cloud). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server-only, for storage list + stats. **Never** expose as `VITE_*`. |

If these are missing, the office page shows a short message to set them on Netlify and redeploy. **No Lovable publish is required** for the job list.

Field `/get?job=` continues to use the anon/publishable key in the browser (no Netlify ZIP streaming).

## Stage D — per-job downloads (signed storage links)

Signed-in users click **Download** on a job row (or browse via **Open**). The server mints time-limited HTTPS links straight to objects in the `exports` bucket (same storage as Export/Sync). Netlify never builds or streams ZIPs.

Uses the same `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as Stage B.

If the service role is missing, the panel still offers **Open download page** (`/get?job=…`), which pulls files from storage in the browser.

## Deploy

Set variables in **Netlify → Site configuration → Environment variables** for Production (and Deploy Previews if you test there). Redeploy after adding or changing them.

Required for a working office explorer:

- `NLF_OFFICE_PASSWORD`
- `NLF_SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`EXPORTS_LIST_TOKEN` is **not** used by Netlify `/office` (legacy Lovable-hosted API only, if still deployed elsewhere).

## Verify

1. Open `https://<your-site>.netlify.app/office`
2. If office login variables are missing, the page explains what to set.
3. After sign-in:
   - With `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set: job folders appear with file count and size, or an empty-state message if none.
   - Without the service role: a short message explains `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
4. Click **Open** on a job: in-office file browser (large jobs). **Download** / `/get?job=<id>` still work.

Field app (`/` → `survey.html`) stays passwordless. Export and `/get?job=` are unchanged.

## Stage C — field Sync (same staging bucket)

From a job’s **⋯** menu, **Sync to office** uploads the same package as cloud Export (picture map PDF, `misc/`, distress photos) into the shared `exports` storage bucket using the existing per-file upload path. No ZIP is built on the phone. Jobs appear in `/office` after refresh (same list as Export cloud uploads).

No new Netlify env vars for Stage C — uploads use the publishable Supabase key already embedded in `survey.html` (same as Export cloud).
