# NLF office explorer — Netlify environment

Password-gated **office File Explorer** at `/office` on the same Netlify site as the field app. No custom domain required.

**Architecture (locked):** Netlify `/office` never holds a Supabase service role. Job list and per-file signed Open links are fetched **server-side** from Lovable Cloud APIs (`visual-surveyor.lovable.app`) using `EXPORTS_LIST_TOKEN`. Lovable has the service role; Netlify does not.

**For Tim:** set only the three Netlify variables below. Do **not** add `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` on Netlify (secret scan can fail the build; the key is not obtainable from Lovable Cloud for Netlify). After code that adds a new Lovable API lands on `main`, **Publish once in Lovable** so that endpoint is live — see `docs/nlf-office-lovable-publish.md`.

## Stage A — office login

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Single shared company password for the office File Explorer (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) used to sign the HttpOnly session cookie. |

## Stage B — job folder list (via Lovable)

The signed-in explorer lists synced job folders by calling:

`GET https://visual-surveyor.lovable.app/api/public/exports-list`

with `Authorization: Bearer <EXPORTS_LIST_TOKEN>` from the Netlify server (never from client code or `VITE_*`).

| Name | Purpose |
| --- | --- |
| `EXPORTS_LIST_TOKEN` | Shared Bearer token. Must match the token configured on Lovable Cloud for the public exports APIs. |

If the token is missing or wrong, `/office` shows a short message. Recursive file counts and sync-incomplete flags come from the Lovable list response (manifest-aware).

Field `/get?job=` continues to use the publishable key in the browser (no Netlify ZIP streaming).

## Stage D — Open / per-job file explorer (via Lovable)

Signed-in users click **Open** on a job. Netlify calls:

`GET https://visual-surveyor.lovable.app/api/public/exports-job?jobId=<id>`

with the same Bearer token. Lovable walks `exports/<jobId>/` and returns the **file list without signed URLs** so large jobs open quickly. When the user clicks Open/Download on a file, Netlify calls:

`GET https://visual-surveyor.lovable.app/api/public/exports-sign?jobId=<id>&path=<relativePath>`

to mint one time-limited signed HTTPS URL. Netlify never builds or streams ZIPs and never needs a service role.

Uses the same `EXPORTS_LIST_TOKEN` as Stage B.

Job list Date / From come from the same `exports-list` response (`syncedAt`, `syncedFrom` from `manifest.json`). Field Sync writes those when uploading (device nickname stored once per phone).

If `exports-job` / `exports-sign` / `exports-delete` / `exports-from` are not published on Lovable yet — **Publish once in Lovable** after merge (see `docs/nlf-office-lovable-publish.md`). List **Download** still uses the legacy package page (`/get?job=…`).

### Delete + From write-back

- **Delete:** Netlify `officeDeleteJob` → Lovable `POST /api/public/exports-delete?jobId=` (removes `exports/<jobId>/…`). Confirm in UI first.
- **From:** Netlify `officeSetJobFrom` → Lovable `POST /api/public/exports-from` with `{ jobId, syncedFrom }` (upserts `manifest.json` fields). Lets staff label older jobs without a full phone re-sync.

### Field Auto-sync

Phone ⋯ menu: **Auto-sync On/Off** (asks once on first background/leave if unset). When On and online, syncs after leaving a job, app background, or connectivity return — only if the job has changes since last sync. Manual Sync + Export unchanged; uploads remain resumable.

## Deploy

Set variables in **Netlify → Site configuration → Environment variables** for Production (and Deploy Previews if you test there). Redeploy after adding or changing them.

Required for a working office explorer on Netlify:

- `NLF_OFFICE_PASSWORD`
- `NLF_SESSION_SECRET`
- `EXPORTS_LIST_TOKEN`

**Do not set on Netlify:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or any service-role secret).

**Also required once after APIs change:** Lovable **Publish** so `exports-list` / `exports-job` are live on `visual-surveyor.lovable.app`.

## Verify

1. Open `https://www.pggphotodocumentation.com/office` (or your Netlify production URL `/office`)
2. If office login variables are missing, the page explains what to set on Netlify.
3. After sign-in:
   - With `EXPORTS_LIST_TOKEN` valid and Lovable APIs published: job folders appear with file count and size.
   - Without a valid token: a short message explains `EXPORTS_LIST_TOKEN`.
4. Click **Open** on a job: in-office file browser (thumbnails, per-file Download). Legacy `/get?job=<id>` still works.

Field app (`/` → `survey.html`) stays passwordless. Export and `/get?job=` are unchanged.

## Stage C — field Sync (same staging bucket)

From a job’s **⋯** menu, **Sync to office** uploads the same package as cloud Export into the shared `exports` storage bucket. No ZIP is built on the phone. Jobs appear in `/office` after refresh.

No new Netlify env vars for Stage C — uploads use the publishable key already embedded in `survey.html` (same as Export cloud).
