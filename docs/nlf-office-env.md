# NLF office explorer — Netlify environment (Stage A)

Stage A adds a password-gated **office shell** at `/office` on the same Netlify site as the field app. No custom domain required.

## Variables

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Single shared company password for the office File Explorer (not field users). |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) used to sign the HttpOnly session cookie. |

Set both in **Netlify → Site configuration → Environment variables** for Production (and Deploy Previews if you test there). Redeploy after adding them.

## Verify

1. Open `https://<your-site>.netlify.app/office`
2. If variables are missing, the page explains what to set.
3. After sign-in, you should see the Stage A placeholder (job list arrives in Stage B).

Field app (`/` → `survey.html`) stays passwordless. Export and `/get?job=` are unchanged.
