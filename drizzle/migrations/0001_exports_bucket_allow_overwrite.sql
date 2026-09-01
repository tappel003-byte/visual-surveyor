CREATE POLICY "anon can update exports"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'exports')
WITH CHECK (bucket_id = 'exports');

CREATE POLICY "anon can delete exports"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'exports');