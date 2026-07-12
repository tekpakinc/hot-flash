alter table profiles add column if not exists music_autoplay boolean not null default false;
alter table vehicles add column if not exists vehicle_type text default 'automobile';
alter table vehicles add column if not exists music_title text;
alter table vehicles add column if not exists music_url text;

create table if not exists build_journal (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  event_date date not null default current_date,
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table build_journal enable row level security;
drop policy if exists "Build journal public read" on build_journal;
drop policy if exists "Owners create journal entries" on build_journal;
drop policy if exists "Owners update journal entries" on build_journal;
drop policy if exists "Owners delete journal entries" on build_journal;
create policy "Build journal public read" on build_journal for select using (true);
create policy "Owners create journal entries" on build_journal for insert with check (auth.uid()=owner_id and exists(select 1 from vehicles where id=vehicle_id and owner_id=auth.uid()));
create policy "Owners update journal entries" on build_journal for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "Owners delete journal entries" on build_journal for delete using (auth.uid()=owner_id);
create index if not exists build_journal_vehicle_idx on build_journal(vehicle_id,event_date desc,created_at desc);

update vehicles set vehicle_type='automobile' where vehicle_type is null;