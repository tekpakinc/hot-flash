-- Hot Flash vehicle image storage setup
-- Run once in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Vehicle images are public readable" on storage.objects;
create policy "Vehicle images are public readable"
on storage.objects for select
using (bucket_id = 'vehicle-images');

drop policy if exists "Users upload own vehicle images" on storage.objects;
create policy "Users upload own vehicle images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own vehicle images" on storage.objects;
create policy "Users update own vehicle images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own vehicle images" on storage.objects;
create policy "Users delete own vehicle images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
