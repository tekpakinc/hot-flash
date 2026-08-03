-- Hot Flash stability and permission hardening pass
-- Run after vehicle media, shops, Hoon Pad, and events migrations.

-- ---------- Media storage: owner-folder enforcement ----------
-- Vehicle images
insert into storage.buckets(id,name,public) values('vehicle-images','vehicle-images',true)
on conflict(id) do update set public=true;
drop policy if exists "Vehicle owners upload images" on storage.objects;
create policy "Vehicle owners upload images" on storage.objects for insert to authenticated
with check(bucket_id='vehicle-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Vehicle owners delete images" on storage.objects;
create policy "Vehicle owners delete images" on storage.objects for delete to authenticated
using(bucket_id='vehicle-images' and (storage.foldername(name))[1]=auth.uid()::text);

-- Vehicle videos
insert into storage.buckets(id,name,public) values('vehicle-videos','vehicle-videos',true)
on conflict(id) do update set public=true;
drop policy if exists "Vehicle owners upload videos" on storage.objects;
create policy "Vehicle owners upload videos" on storage.objects for insert to authenticated
with check(bucket_id='vehicle-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Vehicle owners delete videos" on storage.objects;
create policy "Vehicle owners delete videos" on storage.objects for delete to authenticated
using(bucket_id='vehicle-videos' and (storage.foldername(name))[1]=auth.uid()::text);

-- Hoon Pad videos
insert into storage.buckets(id,name,public) values('hoon-videos','hoon-videos',true)
on conflict(id) do update set public=true;
drop policy if exists "Users upload own Hoon videos" on storage.objects;
create policy "Users upload own Hoon videos" on storage.objects for insert to authenticated
with check(bucket_id='hoon-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users delete own Hoon videos" on storage.objects;
create policy "Users delete own Hoon videos" on storage.objects for delete to authenticated
using(bucket_id='hoon-videos' and (storage.foldername(name))[1]=auth.uid()::text);

-- ---------- Row ownership: media ----------
do $$ begin
  if to_regclass('public.vehicle_images') is not null then
    execute 'alter table public.vehicle_images enable row level security';
    execute 'drop policy if exists "Vehicle owner inserts images" on public.vehicle_images';
    execute 'create policy "Vehicle owner inserts images" on public.vehicle_images for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()))';
    execute 'drop policy if exists "Vehicle owner deletes images" on public.vehicle_images';
    execute 'create policy "Vehicle owner deletes images" on public.vehicle_images for delete to authenticated using(owner_id=auth.uid() and exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()))';
  end if;
  if to_regclass('public.vehicle_videos') is not null then
    execute 'alter table public.vehicle_videos enable row level security';
    execute 'drop policy if exists "Vehicle owner inserts videos" on public.vehicle_videos';
    execute 'create policy "Vehicle owner inserts videos" on public.vehicle_videos for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()))';
    execute 'drop policy if exists "Vehicle owner deletes videos" on public.vehicle_videos';
    execute 'create policy "Vehicle owner deletes videos" on public.vehicle_videos for delete to authenticated using(owner_id=auth.uid() and exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()))';
  end if;
end $$;

-- ---------- Event permissions ----------
create or replace function public.can_manage_event(p_event_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.events e
    where e.id=p_event_id and (
      e.creator_id=p_user_id
      or (e.host_shop_id is not null and exists(
        select 1 from public.shop_members sm
        where sm.shop_id=e.host_shop_id and sm.user_id=p_user_id and sm.status='active'
          and sm.role in ('owner','manager','event_staff')
      ))
      or public.is_hotflash_admin()
    )
  );
$$;

create or replace function public.create_community_event(
  p_title text,p_event_type text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_venue_name text,p_location text,p_website_url text,p_description text,p_host_shop_id uuid default null
) returns public.events language plpgsql security definer set search_path=public as $$
declare v_row public.events;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_location),'') is null or p_starts_at is null then raise exception 'Title, location, and start time are required'; end if;
  if p_ends_at is not null and p_ends_at<p_starts_at then raise exception 'End time must be after start time'; end if;
  if p_host_shop_id is not null and not exists(
    select 1 from public.shop_members sm join public.shop_capabilities sc on sc.shop_id=sm.shop_id
    where sm.shop_id=p_host_shop_id and sm.user_id=auth.uid() and sm.status='active'
      and sm.role in ('owner','manager','event_staff') and sc.can_host_events
  ) then raise exception 'This shop role cannot host events'; end if;
  insert into public.events(creator_id,title,event_type,starts_at,ends_at,venue_name,location,website_url,description,source_type,host_shop_id)
  values(auth.uid(),trim(p_title),p_event_type,p_starts_at,p_ends_at,nullif(trim(coalesce(p_venue_name,'')),''),trim(p_location),nullif(trim(coalesce(p_website_url,'')),''),nullif(trim(coalesce(p_description,'')),''),'community',p_host_shop_id)
  returning * into v_row;
  return v_row;
end;$$;

create or replace function public.delete_community_event(p_event_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_manage_event(p_event_id) then raise exception 'Organizer, authorized shop staff, or admin access required'; end if;
  delete from public.events where id=p_event_id and source_type='community';
  if not found then raise exception 'Only community-created events can be deleted here'; end if;
end;$$;

grant execute on function public.can_manage_event(uuid,uuid) to authenticated;
grant execute on function public.create_community_event(text,text,timestamptz,timestamptz,text,text,text,text,uuid) to authenticated;
grant execute on function public.delete_community_event(uuid) to authenticated;

-- Route community writes through RPCs; imported listings remain read-only.
drop policy if exists "Authenticated users create events" on public.events;
drop policy if exists "Users create events" on public.events;
drop policy if exists "Creators update own events" on public.events;
drop policy if exists "Creators delete own events" on public.events;

comment on function public.can_manage_event(uuid,uuid) is 'Organizer/shop-staff/admin permission check used by all privileged event actions.';