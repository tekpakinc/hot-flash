alter table public.profiles add column if not exists location_public boolean not null default false;
alter table public.profiles add column if not exists allow_messages boolean not null default true;
alter table public.profiles add column if not exists show_online_status boolean not null default false;
alter table public.profiles add column if not exists allow_nearby_discovery boolean not null default false;
alter table public.profiles add column if not exists notify_messages boolean not null default true;
alter table public.profiles add column if not exists notify_comments boolean not null default true;
alter table public.profiles add column if not exists notify_events boolean not null default true;
alter table public.profiles add column if not exists notify_anniversaries boolean not null default true;