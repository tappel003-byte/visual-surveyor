# Fix the failing export — it's a permissions bug, not a size problem

## What's actually wrong

The error on your screen is not the phone running out of room. It is the cloud
storage bucket rejecting the upload:

```text
403 Unauthorized — "new row violates row-level security policy"
```

Confirmed against the backend: the `exports` bucket allows anonymous **upload**
and **read**, but not **overwrite**. Every retry re-sends files as
"upload-or-replace". The moment the app touches a file that already made it up
on the earlier attempt, the server refuses it and the whole run stops. That is
why it fails, and why "Resume upload" fails again in the same place.

Quick Capture photos are not the cause. They are the reason the job is big
enough to take the cloud path in the first place, but the crash is the
permission rule.

## The fix

1. **Allow overwrite and delete on the exports bucket.**
   One backend permission change. Retries and resumes stop being rejected.

2. **Skip what's already uploaded instead of re-sending it.**
   Before uploading, the app asks the bucket which files are already there for
   this job and marks them done. A resume then uploads only what is genuinely
   missing — no wasted time, no re-sending 200 photos.

3. **Remember progress after every file, not every fifth.**
   Right now up to four completed uploads can be forgotten when it stops, which
   forces needless re-sends.

4. **Never dead-end.** If the upload still can't finish, the panel offers
   "Save to this phone in parts" straight away, so the job can come off the
   device with no internet at all.

## Protecting the job you have right now

Nothing is at risk of being lost — the photos live in the app's own storage and
the failed upload does not touch them. After this fix, reopen the job, tap
Export, and the resume will pick up from the files already in the cloud.

## Technical notes

- Migration on `storage.objects`: add `UPDATE` (using + with check
  `bucket_id = 'exports'`) and `DELETE` policies for `anon`, alongside the
  existing INSERT/SELECT ones.
- `public/survey.html`, `_uploadRawAssets()`: before the worker pool starts,
  call the storage list endpoint for `<jobId>/files` (paged, 1000 per page) and
  seed the `done` set from it; write `_writeRawProgress` after each completed
  path instead of every 5.
- Keep `x-upsert: true` — with the UPDATE policy in place it becomes the correct
  idempotent behavior.
- On terminal upload failure, the existing panel adds a
  "Save to this phone in parts" button wired to the current split-ZIP path.
- No changes to pins, photos, Quick Capture, CSV, PDF, or the `/get` page.
