-- Hoon Pad vehicle tagging and hardening
-- Allows members to tag another member's vehicle without attaching it until the owner approves.

alter table public.hoon_posts
  add column if not exists requested_vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists vehicle_tag_status text not null default 'none',
  add column if not exists vehicle_tag_decided_at timestamptz,
  add column if not exists vehicle_tag_decided_by uuid references auth.users(id) on delete set null;

alter table public.hoon_posts drop constraint if exists hoon_posts_vehicle_tag_status_check;
alter table public.hoon_posts add constraint hoon_posts_vehicle_tag_status_check
  check (vehicle_tag_status in ('none','pending','approved','declined','removed'));

create index if not exists hoon_posts_requested_vehicle_idx
  on public.hoon_posts(requested_vehicle_id,vehicle_tag_status,created_at desc);

-- Existing valid links are considered approved.
update public.hoon_posts
set requested_vehicle_id=coalesce(requested_vehicle_id,vehicle_id),
    vehicle_tag_status=case when vehicle_id is not null then 'approved' else 'none' end
where requested_vehicle_id is null or vehicle_tag_status='none';

create or replace function public.create_hoon_post(
  p_video_url text,
  p_storage_path text,
  p_caption text,
  p_venue_type text,
  p_venue_name text,
  p_vehicle_ref text default null,
  p_save_to_build_history boolean default false
) returns public.hoon_posts
language plpgsql security definer set search_path=public
as $$
declare
  v_vehicle public.vehicles;
  v_row public.hoon_posts;
  v_is_owner boolean := false;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_venue_type not in ('track','drift_event','drag_strip','private_property','off_road_park','closed_course') then
    raise exception 'Invalid venue type';
  end if;
  if nullif(trim(coalesce(p_video_url,'')),'') is null or nullif(trim(coalesce(p_storage_path,'')),'') is null then
    raise exception 'Video upload details are required';
  end if;

  if nullif(trim(coalesce(p_vehicle_ref,'')),'') is not null then
    select * into v_vehicle from public.vehicles
    where id::text=trim(p_vehicle_ref) or upper(hotflash_id)=upper(trim(p_vehicle_ref))
    limit 1;
    if v_vehicle.id is null then raise exception 'Vehicle not found'; end if;
    v_is_owner := v_vehicle.owner_id=auth.uid();
  end if;

  insert into public.hoon_posts(
    author_id,vehicle_id,requested_vehicle_id,vehicle_tag_status,
    video_url,storage_path,caption,venue_type,venue_name,
    legal_attestation,save_to_build_history
  ) values (
    auth.uid(),
    case when v_is_owner then v_vehicle.id else null end,
    v_vehicle.id,
    case when v_vehicle.id is null then 'none' when v_is_owner then 'approved' else 'pending' end,
    trim(p_video_url),trim(p_storage_path),nullif(trim(coalesce(p_caption,'')),''),
    p_venue_type,nullif(trim(coalesce(p_venue_name,'')),''),true,
    case when v_is_owner then coalesce(p_save_to_build_history,false) else false end
  ) returning * into v_row;
  return v_row;
end;$$;

create or replace function public.respond_to_hoon_vehicle_tag(p_post_id uuid,p_accept boolean)
returns public.hoon_posts
language plpgsql security definer set search_path=public
as $$
declare v_post public.hoon_posts; v_owner uuid;
begin
  select * into v_post from public.hoon_posts where id=p_post_id for update;
  if v_post.id is null then raise exception 'Post not found'; end if;
  if v_post.vehicle_tag_status<>'pending' or v_post.requested_vehicle_id is null then raise exception 'No pending vehicle tag'; end if;
  select owner_id into v_owner from public.vehicles where id=v_post.requested_vehicle_id;
  if v_owner<>auth.uid() then raise exception 'Only the vehicle owner can respond'; end if;
  update public.hoon_posts set
    vehicle_id=case when p_accept then requested_vehicle_id else null end,
    vehicle_tag_status=case when p_accept then 'approved' else 'declined' end,
    vehicle_tag_decided_at=now(),vehicle_tag_decided_by=auth.uid(),
    save_to_build_history=case when p_accept then save_to_build_history else false end
  where id=p_post_id returning * into v_post;
  return v_post;
end;$$;

create or replace function public.remove_hoon_vehicle_tag(p_post_id uuid)
returns public.hoon_posts
language plpgsql security definer set search_path=public
as $$
declare v_post public.hoon_posts; v_owner uuid;
begin
  select * into v_post from public.hoon_posts where id=p_post_id for update;
  if v_post.id is null then raise exception 'Post not found'; end if;
  select owner_id into v_owner from public.vehicles where id=coalesce(v_post.vehicle_id,v_post.requested_vehicle_id);
  if auth.uid()<>v_owner and auth.uid()<>v_post.author_id and not public.is_hotflash_admin() then
    raise exception 'Not allowed to remove this tag';
  end if;
  update public.hoon_posts set vehicle_id=null,vehicle_tag_status='removed',save_to_build_history=false,
    vehicle_tag_decided_at=now(),vehicle_tag_decided_by=auth.uid()
  where id=p_post_id returning * into v_post;
  return v_post;
end;$$;

grant execute on function public.create_hoon_post(text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.respond_to_hoon_vehicle_tag(uuid,boolean) to authenticated;
grant execute on function public.remove_hoon_vehicle_tag(uuid) to authenticated;

-- Replace direct inserts with the controlled RPC.
drop policy if exists "Users can post own legal Hoon clips" on public.hoon_posts;

-- Owners may read pending tag requests for their vehicles; public still sees legal posts.
drop policy if exists "Anyone can view Hoon Pad" on public.hoon_posts;
create policy "Anyone can view Hoon Pad" on public.hoon_posts for select to anon,authenticated
using (
  legal_attestation=true
  or author_id=auth.uid()
  or exists(select 1 from public.vehicles v where v.id=requested_vehicle_id and v.owner_id=auth.uid())
);

comment on column public.hoon_posts.vehicle_tag_status is 'Vehicle association state: pending tags are not attached to the vehicle until its owner approves.';