# Cloud transfer export — one link instead of many ZIPs

## How it works (setup explained)

The app already builds the ZIP parts correctly — the only unreliable step is handing multiple files to the iPhone share sheet. Instead of sharing files, the phone will **upload each part to Lovable Cloud storage** as it's built, then give you **one link**. Open that link on your computer and download all parts from one page.

No accounts, no Google/Drive setup, nothing to install. The link is a long random URL — anyone with the link can download, links expire after 7 days.

## What gets built

1. **Storage bucket** (one-time backend change)
   - Create a private `exports` bucket via migration.
   - Public read policy on it (files are reachable only via their unguessable random paths — no listing).

2. **New export path in `public/survey.html`**
   - Export sheet gets a new button for large jobs: **"Upload & get one link"** alongside the existing share/download option.
   - Builds each part exactly as today (same batching, same ZIP contents, same progress panel), but after each part is built it uploads it straight to cloud storage and frees the memory — the phone never holds more than one part at a time.
   - Uploads go to `exports/<random-job-id>/part-N-of-M.zip`.

3. **One-link download page**
   - New tiny route (e.g. `/get?job=<random-job-id>`) that lists the job's parts with download buttons + the existing reassembly instructions ("put all parts in the same folder, unzip").
   - After upload finishes, the phone shows the link with **Copy** and **Share** buttons (sharing plain text — one short link always works in Mail/text/WhatsApp, unlike files).

4. **Completion behavior**
   - Panel shows the link prominently, marks the export complete, and closes cleanly on dismiss (same close-on-finish behavior as current export).

## Technical details

- Uses the existing generated Supabase client (`@/integrations/supabase/client`) — storage uploads work offline-first apps fine since export is an online operation; if the upload fails mid-way, panel offers Retry (re-uploads just that part) or fall back to the current save-one-at-a-time flow.
- No auth required: bucket policy allows anon INSERT into `exports/` and anon SELECT; paths are `crypto.randomUUID()` job folders so they can't be guessed or enumerated.
- Links valid 7 days via the download page; a note on the page says files are auto-removed after that (lifecycle rule on the bucket).
- No changes to pins, photos, ZIP contents, part sizing (stays 100), CSV/PDF generation, or the existing direct-share path for small jobs.

## Verification

- Build passes.
- Browser test: create a test project with IndexedDB photos, run export, confirm uploads land in the bucket and the `/get` page downloads every part.
