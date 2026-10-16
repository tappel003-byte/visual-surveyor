# NLF office explorer — Netlify environment

Password-gated **office File Explorer** at `/office` on the same Netlify site as the field app. No custom domain required.

## Stage A — office login

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Single shared company password for the office File Explorer (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) used to sign the HttpOnly session cookie. |

## Stage B — job folder list (server-only Lovable API)

The signed-in explorer lists export job folders by calling the Lovable-hosted exports API on the **server only** (never from client code or `VITE_*` variables).

| Name | Purpose |
| --- | --- |
| `EXPORTS_LIST_TOKEN` | Bearer token for `GET https://visual-surveyor.lovable.app/api/public/exports-list`. Must match the token configured on Lovable. |

`SUPABASE_SERVICE_ROLE_KEY` is **not** required for `/office`. Field `/get?job=` continues to use the anon/publishable key in the browser.

## Deploy

Set variables in **Netlify → Site configuration → Environment variables** for Production (and Deploy Previews if you test there). Redeploy after adding or changing them.

## Verify

1. Open `https://<your-site>.netlify.app/office`
2. If office variables are missing, the page explains what to set.
3. After sign-in:
   - With `EXPORTS_LIST_TOKEN` set and valid: job folders appear with file count and size, or an empty-state message if none.
   - Without a valid token: a short message explains `EXPORTS_LIST_TOKEN`.

Field app (`/` → `survey.html`) stays passwordless. Export and `/get?job=` are unchanged.
