-- Hot Flash Alpha schema
-- Run this in Supabase SQL Editor before testing signup/login dashboard data.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  founder_number integer unique,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hotflash_id text unique,
  slug text not null,
  nickname text not null,
  year integer,
  make text,
  model text,
  trim text,
  engine text,
  horsepower integer,
  cover_photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_followers (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);

create or replace function public.assign_hotflash_id()
returns trigger as $$
begin
  if new.hotflash_id is null then
    new.hotflash_id := 'HF-' || lpad(nextval('public.vehicle_hotflash_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create sequence if not exists public.vehicle_hotflash_seq start with 1;

drop trigger if exists vehicles_assign_hotflash_id on public.vehicles;
create trigger vehicles_assign_hotflash_id
before insert on public.vehicles
for each row execute function public.assign_hotflash_id();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_followers enable row level security;

create policy "Profiles are public readable"
  on public.profiles for select
  using (true);

create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Vehicles are public readable"
  on public.vehicles for select
  using (true);

create policy "Users insert own vehicles"
  on public.vehicles for insert
  with check (auth.uid() = owner_id);

create policy "Users update own vehicles"
  on public.vehicles for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users delete own vehicles"
  on public.vehicles for delete
  using (auth.uid() = owner_id);

create policy "Vehicle follows are public readable"
  on public.vehicle_followers for select
  using (true);

create policy "Users can follow vehicles"
  on public.vehicle_followers for insert
  with check (auth.uid() = user_id);

create policy "Users can unfollow vehicles"
  on public.vehicle_followers for delete
  using (auth.uid() = user_id);
