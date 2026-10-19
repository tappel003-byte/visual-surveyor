# NLF office + Sync — host split through 16 Dec 2026

Password-gated **office File Explorer** at `/office` and field **Sync to office**.

## Host split (Tim 2026-10-19)

| Host | Sync | /office list · Download · Delete |
| --- | --- | --- |
| **www.pggphotodocumentation.com** (Netlify) | Netlify Blobs + `NLF_FIELD_KEY` | **Blobs only.** Empty list is correct until a phone Syncs new work. Do **not** show old Lovable jobs here. |
| **\*.lovable.app** | Previous Supabase upload path | Supabase locker (old jobs). Open / Download / Delete for Grace, etc. Does **not** need `NLF_*`. |

Old ~15 Lovable jobs stay in the old locker — **not migrated, not deleted**. Use **lovable.app /office** for those through **16 Dec 2026**.

**Do not set on Netlify:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Netlify (www) — required

| Name | Purpose |
| --- | --- |
| `NLF_OFFICE_PASSWORD` | Shared company password for `/office`. |
| `NLF_SESSION_SECRET` | Random secret (≥16 chars) for the office session cookie. |
| `NLF_FIELD_KEY` | Must match `PGG_FIELD_KEY` in `public/survey.html`. |
| `EXPORTS_LIST_TOKEN` | **Not required for www list.** Optional leftover; www does not merge old Lovable jobs. |

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

1. **www:** open `/office` → sign in → list is empty until a new Sync → Sync from a www phone → job appears → Open / Download package / Delete on Blobs.
2. **lovable.app:** Publish once after path/Open fixes → `/office` still lists old jobs → Open `picture map.pdf` and CSV → Download works.
3. Do **not** expect Grace / Christine on www.

Field app (`/` → `survey.html`) stays passwordless. Capture UI is unchanged.
