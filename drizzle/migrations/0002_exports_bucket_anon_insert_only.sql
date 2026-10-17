-- LOCKDOWN: anon INSERT only on exports
-- Apply via Lovable SQL / Publish AFTER field phones run App 2026.10.17-sec
-- (Update app on every phone first — old shells still need SELECT/UPDATE).
-- Do NOT apply from this repo automatically. Tim pastes in Lovable.

DROP POLICY IF EXISTS "anon can read exports" ON storage.objects;
DROP POLICY IF EXISTS "anon can update exports" ON storage.objects;
DROP POLICY IF EXISTS "anon can delete exports" ON storage.objects;
-- leave in place: "anon can upload exports" (INSERT)

-- ROLLBACK (restore 0000 + 0001 behavior) — paste separately only if Sync/office break:
-- CREATE POLICY "anon can read exports"
-- ON storage.objects FOR SELECT TO anon
-- USING (bucket_id = 'exports');
--
-- CREATE POLICY "anon can update exports"
-- ON storage.objects FOR UPDATE TO anon
-- USING (bucket_id = 'exports')
-- WITH CHECK (bucket_id = 'exports');
--
-- CREATE POLICY "anon can delete exports"
-- ON storage.objects FOR DELETE TO anon
-- USING (bucket_id = 'exports');
