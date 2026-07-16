-- HOT FLASH VEHICLE VIDEOS
create table if not exists vehicle_videos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  video_url text not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table vehicle_videos enable row level security;

create policy "Vehicle videos public read"
on vehicle_videos for select
using (true);

create policy "Owners add vehicle videos"
on vehicle_videos for insert
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from vehicles v
    where v.id = vehicle_id and v.owner_id = auth.uid()
  )
);

create policy "Owners update vehicle videos"
on vehicle_videos for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Owners delete vehicle videos"
on vehicle_videos for delete
using (auth.uid() = owner_id);

create index if not exists vehicle_videos_vehicle_idx
on vehicle_videos(vehicle_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-videos',
  'vehicle-videos',
  true,
  52428800,
  array['video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Vehicle videos storage public read"
on storage.objects for select
using (bucket_id = 'vehicle-videos');

create policy "Users upload own vehicle videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vehicle-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete own vehicle videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vehicle-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
