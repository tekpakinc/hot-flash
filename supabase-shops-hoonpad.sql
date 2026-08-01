-- Hot Flash Community Shops + Hoon Pad implementation
-- Run once in Supabase SQL Editor after supabase-community-shops.sql.

create extension if not exists pgcrypto;

alter table public.shops
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists hours_text text,
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active','restricted','suspended'));

-- Link existing events to a host shop when the events table exists.
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'alter table public.events add column if not exists host_shop_id uuid references public.shops(id) on delete set null';
    execute 'create index if not exists events_host_shop_idx on public.events(host_shop_id,starts_at)';
  end if;
end $$;

create table if not exists public.community_badge_types (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null default '🏅',
  is_safety_related boolean not null default false,
  is_active boolean not null default true
);

insert into public.community_badge_types(code,name,description,icon,is_safety_related) values
  ('respectful_driver','Respectful Driver','Recognized for safe, respectful behavior at an automotive event.','🚗',true),
  ('helpful_builder','Helpful Builder','Helped another enthusiast solve a problem or keep a build moving.','🔧',false),
  ('event_volunteer','Event Volunteer','Contributed time or effort to help an event run smoothly.','🎉',false),
  ('helped_cleanup','Left It Better','Helped clean up or protect the event venue.','🧹',true),
  ('community_mentor','Community Mentor','Shared knowledge patiently and constructively.','🤝',false),
  ('venue_friendly','Venue Friendly','Consistently helped keep events safe and welcome at their venues.','🛡️',true),
  ('great_photographer','Great Photographer','Captured and shared the community in a positive way.','📸',false),
  ('roadside_hero','Roadside Hero','Helped another member through a breakdown or mechanical issue.','🧰',false)
on conflict (code) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,is_safety_related=excluded.is_safety_related,is_active=true;

create table if not exists public.event_recognitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  shop_id uuid not null references public.shops(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.community_badge_types(code),
  awarded_by uuid not null references auth.users(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  unique(event_id,recipient_user_id,badge_code,shop_id)
);

create table if not exists public.event_incident_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  shop_id uuid not null references public.shops(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_vehicle_id uuid references public.vehicles(id) on delete set null,
  category text not null check (category in ('unsafe_driving','burnout_at_venue','harassment','aggressive_behavior','property_damage','ignored_event_rules','other')),
  description text not null,
  evidence_url text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','under_review','dismissed','confirmed','actioned')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_work_verifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_label text not null,
  details text,
  verified_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'verified' check (status in ('pending','verified','disputed','removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.hoon_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  video_url text not null,
  storage_path text not null,
  caption text,
  venue_type text not null check (venue_type in ('track','drift_event','drag_strip','private_property','off_road_park','closed_course')),
  venue_name text,
  legal_attestation boolean not null default false,
  save_to_build_history boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hoon_flames (
  post_id uuid not null references public.hoon_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create index if not exists event_recognitions_recipient_idx on public.event_recognitions(recipient_user_id,created_at desc);
create index if not exists incident_reports_status_idx on public.event_incident_reports(status,created_at desc);
create index if not exists incident_reports_shop_idx on public.event_incident_reports(shop_id,created_at desc);
create index if not exists shop_work_vehicle_idx on public.shop_work_verifications(vehicle_id,created_at desc);
create index if not exists hoon_posts_created_idx on public.hoon_posts(created_at desc);
create index if not exists hoon_posts_vehicle_idx on public.hoon_posts(vehicle_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hoon-videos','hoon-videos',true,104857600,array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public=true,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;

alter table public.community_badge_types enable row level security;
alter table public.event_recognitions enable row level security;
alter table public.event_incident_reports enable row level security;
alter table public.shop_work_verifications enable row level security;
alter table public.hoon_posts enable row level security;
alter table public.hoon_flames enable row level security;

drop policy if exists "Anyone can view active badge types" on public.community_badge_types;
create policy "Anyone can view active badge types" on public.community_badge_types for select to anon,authenticated using (is_active);

drop policy if exists "Anyone can view recognitions" on public.event_recognitions;
create policy "Anyone can view recognitions" on public.event_recognitions for select to anon,authenticated using (true);

drop policy if exists "Shop staff can award recognitions" on public.event_recognitions;
create policy "Shop staff can award recognitions" on public.event_recognitions for insert to authenticated with check (
  awarded_by=auth.uid() and exists (
    select 1 from public.shop_members sm join public.shop_capabilities sc on sc.shop_id=sm.shop_id
    where sm.shop_id=event_recognitions.shop_id and sm.user_id=auth.uid() and sm.status='active'
      and sm.role in ('owner','manager','event_staff') and sc.can_award_event_badges
  )
);

drop policy if exists "Shop staff can view own incidents" on public.event_incident_reports;
create policy "Shop staff can view own incidents" on public.event_incident_reports for select to authenticated using (
  submitted_by=auth.uid() or exists (
    select 1 from public.shop_members sm where sm.shop_id=event_incident_reports.shop_id and sm.user_id=auth.uid() and sm.status='active'
  )
);

drop policy if exists "Shop staff can submit incidents" on public.event_incident_reports;
create policy "Shop staff can submit incidents" on public.event_incident_reports for insert to authenticated with check (
  submitted_by=auth.uid() and exists (
    select 1 from public.shop_members sm join public.shop_capabilities sc on sc.shop_id=sm.shop_id
    where sm.shop_id=event_incident_reports.shop_id and sm.user_id=auth.uid() and sm.status='active'
      and sm.role in ('owner','manager','event_staff') and sc.can_submit_incident_reports
  )
);

drop policy if exists "Anyone can view verified professional work" on public.shop_work_verifications;
create policy "Anyone can view verified professional work" on public.shop_work_verifications for select to anon,authenticated using (status='verified');

drop policy if exists "Shop staff can verify work" on public.shop_work_verifications;
create policy "Shop staff can verify work" on public.shop_work_verifications for insert to authenticated with check (
  verified_by=auth.uid() and exists (
    select 1 from public.shop_members sm join public.shop_capabilities sc on sc.shop_id=sm.shop_id
    where sm.shop_id=shop_work_verifications.shop_id and sm.user_id=auth.uid() and sm.status='active'
      and sm.role in ('owner','manager') and sc.can_verify_work
  )
);

drop policy if exists "Anyone can view Hoon Pad" on public.hoon_posts;
create policy "Anyone can view Hoon Pad" on public.hoon_posts for select to anon,authenticated using (legal_attestation=true);

drop policy if exists "Users can post own legal Hoon clips" on public.hoon_posts;
create policy "Users can post own legal Hoon clips" on public.hoon_posts for insert to authenticated with check (
  author_id=auth.uid() and legal_attestation=true and (vehicle_id is null or exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()))
);

drop policy if exists "Users can delete own Hoon clips" on public.hoon_posts;
create policy "Users can delete own Hoon clips" on public.hoon_posts for delete to authenticated using (author_id=auth.uid());

drop policy if exists "Anyone can view Hoon flames" on public.hoon_flames;
create policy "Anyone can view Hoon flames" on public.hoon_flames for select to anon,authenticated using (true);

drop policy if exists "Users can add own Hoon flames" on public.hoon_flames;
create policy "Users can add own Hoon flames" on public.hoon_flames for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "Users can remove own Hoon flames" on public.hoon_flames;
create policy "Users can remove own Hoon flames" on public.hoon_flames for delete to authenticated using (user_id=auth.uid());

-- Storage rules: authenticated users write only inside their own first-level folder.
drop policy if exists "Public reads Hoon videos" on storage.objects;
create policy "Public reads Hoon videos" on storage.objects for select to anon,authenticated using (bucket_id='hoon-videos');

drop policy if exists "Users upload own Hoon videos" on storage.objects;
create policy "Users upload own Hoon videos" on storage.objects for insert to authenticated with check (
  bucket_id='hoon-videos' and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users delete own Hoon videos" on storage.objects;
create policy "Users delete own Hoon videos" on storage.objects for delete to authenticated using (
  bucket_id='hoon-videos' and (storage.foldername(name))[1]=auth.uid()::text
);

create or replace function public.add_shop_member(p_shop_id uuid,p_username text,p_role text default 'manager')
returns public.shop_members language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_row public.shop_members;
begin
  if not exists(select 1 from public.shops where id=p_shop_id and owner_user_id=auth.uid()) then raise exception 'Only the shop owner can manage staff'; end if;
  if p_role not in ('manager','event_staff') then raise exception 'Invalid shop role'; end if;
  select id into v_user from public.profiles where lower(username)=lower(trim(both '@' from p_username));
  if v_user is null then raise exception 'Member not found'; end if;
  insert into public.shop_members(shop_id,user_id,role,status,invited_by) values(p_shop_id,v_user,p_role,'active',auth.uid())
  on conflict(shop_id,user_id) do update set role=excluded.role,status='active',invited_by=auth.uid()
  returning * into v_row;
  return v_row;
end $$;

grant execute on function public.add_shop_member(uuid,text,text) to authenticated;

comment on table public.hoon_posts is 'Chronological short-form action clips recorded at tracks, private property, or other legal venues.';
comment on table public.event_incident_reports is 'Private, reviewable incident reports submitted by scoped shop/event stewards; never public automatically.';