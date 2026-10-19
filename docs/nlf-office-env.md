# NLF office + Sync — Netlify environment

Password-gated **office File Explorer** at `/office` and field **Sync to office** on the same Netlify site. Temporary photo locker uses **Netlify Blobs** (site-wide store). www does **not** call Lovable or Supabase for Sync / list / Download / Delete.

**For Tim:** set the three Netlify variables below. Do **not** add `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` on Netlify.

## Required

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Shared company password for `/office` (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) for the office session cookie. |
| `NLF_FIELD_KEY` | Must match the `PGG_FIELD_KEY` value baked into `public/survey.html`. Speed bump only — caps + daily upload limit are the real protection. |

## Optional / retired

| Name | Purpose |
| --- | --- |
| `EXPORTS_LIST_TOKEN` | **Retired after cutover.** Was only used to call Lovable. Safe to delete from Netlify once Sync → `/office` is proven. Leaving it unused does no harm. |

**Do not set on Netlify:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Caps (built into the app)

- Locker about **1 GB** total
- Per-file and per-job size caps
- **Daily upload limit** across all phones
- Incomplete Sync pieces older than a few days are cleaned when someone lists or uploads (no scheduled jobs)

## Deploy

Set variables in **Netlify → Site configuration → Environment variables** for Production. Redeploy after adding or changing them.

## Verify

1. Open `https://www.pggphotodocumentation.com/office` and sign in.
2. From a phone: **Update app** → version shows `App 2026.10.19-nlf` → **Sync to office**.
3. Desk: see the job → Download (per file) → Delete → confirm **Downloaded this month (estimate)** moved.
4. Real bandwidth number: Netlify → **Usage** (the in-app counter is an estimate only).

Field app (`/` → `survey.html`) stays passwordless. Capture UI is unchanged.
