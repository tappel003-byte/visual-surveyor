-- Drop any existing permissive policies on the survey-photos bucket
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND (polname ILIKE '%survey%photo%' OR polname ILIKE '%survey_photo%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.polname);
  END LOOP;
END $$;

-- Owner-scoped policies: path must be "<auth.uid()>/..."
CREATE POLICY "survey-photos: owners can read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "survey-photos: owners can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "survey-photos: owners can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "survey-photos: owners can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
