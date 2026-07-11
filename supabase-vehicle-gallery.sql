-- Hot Flash vehicle gallery migration

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_images_vehicle_id_idx
  on public.vehicle_images(vehicle_id, sort_order, created_at);

alter table public.vehicle_images enable row level security;

drop policy if exists "Vehicle images are public readable" on public.vehicle_images;
create policy "Vehicle images are public readable"
  on public.vehicle_images for select
  using (true);

drop policy if exists "Owners insert vehicle images" on public.vehicle_images;
create policy "Owners insert vehicle images"
  on public.vehicle_images for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.vehicles
      where vehicles.id = vehicle_images.vehicle_id
        and vehicles.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners update vehicle images" on public.vehicle_images;
create policy "Owners update vehicle images"
  on public.vehicle_images for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owners delete vehicle images" on public.vehicle_images;
create policy "Owners delete vehicle images"
  on public.vehicle_images for delete
  using (auth.uid() = owner_id);
