# NLF office explorer — Netlify environment

Password-gated **office File Explorer** at `/office` on the same Netlify site as the field app. No custom domain required.

## Stage A — office login

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Single shared company password for the office File Explorer (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) used to sign the HttpOnly session cookie. |

## Stage B — job folder list (server-only Supabase)

The signed-in explorer lists top-level folders in the Supabase Storage bucket `exports` using the **service role** on the server only (never in client code or `VITE_*` variables).

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL (same as field app / Lovable Cloud). Often already set for `/get`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret — **server-only**; required for `/office` to list jobs. Do not prefix with `VITE_`. |

If these are missing, `/office` still signs in but shows instructions to add them. Field `/get?job=` continues to use the anon/publishable key in the browser.

## Deploy

Set variables in **Netlify → Site configuration → Environment variables** for Production (and Deploy Previews if you test there). Redeploy after adding or changing them.

## Verify

1. Open `https://<your-site>.netlify.app/office`
2. If office variables are missing, the page explains what to set.
3. After sign-in:
   - With Supabase server vars set: job folders from `exports` appear, or an empty-state message if none.
   - Without Supabase server vars: a banner explains `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

Field app (`/` → `survey.html`) stays passwordless. Export and `/get?job=` are unchanged.
