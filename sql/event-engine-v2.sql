-- HOT FLASH EVENT ENGINE V2
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('google','ics','facebook','eventbrite','motorsportreg','ticketmaster','hotflash')),
  source_url text,
  calendar_id text,
  enabled boolean not null default true,
  sync_frequency_minutes integer not null default 180 check (sync_frequency_minutes between 15 and 10080),
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type, source_url),
  unique(source_type, calendar_id)
);

create table if not exists public.event_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.event_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text
);

alter table public.events add column if not exists event_source_id uuid references public.event_sources(id) on delete set null;
alter table public.events add column if not exists organizer_name text;
alter table public.events add column if not exists address text;
alter table public.events add column if not exists city text;
alter table public.events add column if not exists state text;
alter table public.events add column if not exists postal_code text;
alter table public.events add column if not exists approved boolean not null default true;
alter table public.events add column if not exists featured boolean not null default false;
alter table public.events add column if not exists cancelled boolean not null default false;
alter table public.events add column if not exists updated_at timestamptz not null default now();
alter table public.events add column if not exists last_synced_at timestamptz;

create index if not exists event_sources_enabled_idx on public.event_sources(enabled, source_type);
create index if not exists event_sync_runs_source_idx on public.event_sync_runs(source_id, started_at desc);
create index if not exists events_source_start_idx on public.events(event_source_id, starts_at);
create index if not exists events_approved_start_idx on public.events(approved, starts_at);

alter table public.event_sources enable row level security;
alter table public.event_sync_runs enable row level security;

-- Public may only read enabled source attribution.
drop policy if exists "Public reads enabled event sources" on public.event_sources;
create policy "Public reads enabled event sources" on public.event_sources
for select using (enabled = true);

-- Event-source management is intentionally service-role only for now.
-- The Super Admin page calls the sync Edge Function, which validates admin access.

-- Existing public event policy remains in place. Hide unapproved records from normal clients.
drop policy if exists "Events public read" on public.events;
create policy "Events public read" on public.events
for select using (approved = true);

-- Optional seed source example. Replace with a real public Google Calendar ID or ICS URL.
-- insert into public.event_sources(name, source_type, calendar_id)
-- values ('Example Public Calendar', 'google', 'example@group.calendar.google.com');
