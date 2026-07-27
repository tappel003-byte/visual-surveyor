
insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', true)
on conflict (id) do nothing;

create policy "Public read survey photos"
  on storage.objects for select
  using (bucket_id = 'survey-photos');

create policy "Anyone can upload survey photos"
  on storage.objects for insert
  with check (bucket_id = 'survey-photos');
