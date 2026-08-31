create policy "anon can upload exports"
on storage.objects for insert to anon
with check (bucket_id = 'exports');

create policy "anon can read exports"
on storage.objects for select to anon
using (bucket_id = 'exports');