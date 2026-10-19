# NLF office + Sync — dual host until 16 Dec 2026

Password-gated **office File Explorer** at `/office` and field **Sync to office**.

## Dual-host (required through 16 Dec 2026)

| Host | Sync | /office list · Download · Delete |
| --- | --- | --- |
| **www.pggphotodocumentation.com** (Netlify) | Netlify Blobs + `NLF_FIELD_KEY` | **Both** Netlify Blobs (new Syncs) **and** the old Lovable locker via `EXPORTS_LIST_TOKEN` |
| **\*.lovable.app** | Previous Supabase upload path | Supabase locker (service role on Lovable). Does **not** need `NLF_*`. |

Old ~15 Lovable jobs stay in the old locker — **not migrated, not deleted**. www reads them again through the shared list token.

**Do not set on Netlify:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Netlify (www) — required

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Shared company password for `/office`. |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) for the office session cookie. |
| `NLF_FIELD_KEY` | Must match `PGG_FIELD_KEY` in `public/survey.html`. |
| `EXPORTS_LIST_TOKEN` | **Keep until sunset.** Lets www list / Download / Delete jobs still in the old Lovable locker (Grace St and other prior Syncs). |

## Lovable host — optional

| Name | Purpose |
| --- | --- |
| `OFFICE_PASSWORD` | Optional. Same company password as www. If unset, `/office` still accepts sign-in (interim until sunset). |
| `NLF_SESSION_SECRET` | Optional. If unset, session signing derives from the Lovable service role. |

## Caps (www Blobs locker)

- Locker about **1 GB** total
- Per-file and per-job size caps
- **Daily upload limit** across all phones
- Incomplete Sync pieces older than a few days are cleaned when someone lists or uploads

## Verify

1. **www:** open `/office` → sign in → older Lovable jobs (e.g. Grace St) appear **and** any new Blobs Syncs appear → Download package → Delete works on each.
2. **Phone on www:** Update app → version `App 2026.10.19-dual` → Sync → job shows under Blobs on www `/office`.
3. **lovable.app:** Update app / Publish → Sync still works (Supabase path) → `/office` sign-in works without Netlify-only secrets → old jobs still listed.

Field app (`/` → `survey.html`) stays passwordless. Capture UI is unchanged.
