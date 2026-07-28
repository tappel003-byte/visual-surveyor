
## What I will NOT do
- I will not change the room-recognition code.
- I will not touch the service worker, manifest, or icon files.
- I will not "just add a fix" without first showing you evidence of the cause.

## What I already checked (read-only, just now)
- Storage key is `pgg_survey_v1` in `localStorage`, plus photos in IndexedDB `pgg_photos_v1`. **Neither key has been renamed in any recent change.**
- The room-recognition edit I made only changed two JS functions (`cleanRawRoomText` and the pin→room matcher). It does not call `localStorage.removeItem`, `caches.delete`, or `indexedDB.deleteDatabase`.
- The service worker at `src/sw.ts` deletes **Cache Storage** entries on activate. Cache Storage is separate from localStorage and IndexedDB — clearing it does NOT delete saved projects.

So on paper, my edit should not have wiped your projects. That means the real cause is something else, and I want to prove which one before touching anything.

## Most likely real causes (need to confirm, not guess)
1. **Different origin between preview and published URL.** localStorage is per-origin. If the iPad shortcut opened `id-preview--…lovable.app` one time and `visual-surveyor.lovable.app` (or the PGG published URL) another time, each origin has its own empty project list. This has nothing to do with any code edit.
2. **iPadOS evicted site data** for the PWA (iOS aggressively clears storage for sites not used in ~7 days, or under storage pressure). Also independent of my edits.
3. **A JSON parse error on load** (corrupt row) causing `store.projects` to reset to `[]`. The current `load()` catches the error but then silently continues with an empty store — no warning, no backup.

## Plan

### Step 1 — Diagnose (read-only, one short turn)
On the device where projects disappeared, open the app and run a tiny inspector I'll give you (paste into Safari address bar or I'll add a hidden diagnostic button). It reports:
- exact origin/URL the shortcut is loading
- whether `pgg_survey_v1` exists, its size, and how many projects it contains
- whether the IndexedDB `pgg_photos_v1` still has photos
- any JSON parse error

This tells us in one look whether it's an origin mismatch, an eviction, or a corruption. **No code fix happens until this returns an answer.**

### Step 2 — Add a safety net (only after diagnosis)
Regardless of cause, add these guardrails so this can never silently wipe you again:
- **Auto-backup on every save**: keep the last 3 full snapshots of `store` under rolling keys (`pgg_survey_v1.bak1/2/3`). Cheap, text-only, no photos duplicated.
- **Restore-from-backup button** on the home screen, visible only when a backup exists and the current project list is empty or smaller than the backup.
- **Loud toast** if `load()` catches a parse error, instead of silently continuing with `[]`.
- **Never overwrite** a non-empty backup with an empty store.

### Step 3 — Address the root cause found in Step 1
- If origin mismatch: I'll show you which URL to always use for the shortcut and add a one-time migration that copies data across origins if both are reachable.
- If iPad eviction: the backup + a periodic "Move to Desktop" reminder is the only real defense — iOS gives no way to opt out of eviction for a website.
- If corruption: fix the specific bad field and load from the newest good backup.

## Technical detail (for reference)
Files that would change in Step 2 only, and only after you approve:
- `public/survey.html` — `save()` writes rolling backup; `load()` surfaces parse errors; small "Restore backup" UI on home screen.
No changes to service worker, manifest, icons, room-recognition, or export code.

## What I need from you to proceed
Just: "run the diagnostic" (Step 1) or "skip diagnosis, add the backup safety net now" (jump to Step 2).
