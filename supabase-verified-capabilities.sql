-- Hot Flash Verified member capabilities
-- Run after the profiles table and admin role functions exist.

alter table public.profiles
  add column if not exists member_tier text not null default 'free',
  add column if not exists verified_membership_status text not null default 'inactive',
  add column if not exists verified_membership_started_at timestamptz,
  add column if not exists verified_membership_expires_at timestamptz;

alter table public.profiles drop constraint if exists profiles_member_tier_check;
alter table public.profiles add constraint profiles_member_tier_check
  check (member_tier in ('free','verified'));

alter table public.profiles drop constraint if exists profiles_verified_membership_status_check;
alter table public.profiles add constraint profiles_verified_membership_status_check
  check (verified_membership_status in ('inactive','pending','active','past_due','cancelled','revoked'));

create table if not exists public.member_capability_types (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null default '⭐',
  verified_only boolean not null default true,
  is_public_tag boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.member_capability_types(code,name,description,icon,verified_only,is_public_tag) values
 ('creator_tools','Creator','Creates original automotive content and can use verified creator tools.','🎥',true,true),
 ('photographer_tools','Photographer','Creates automotive photography and can use verified photography tools.','📸',true,true),
 ('videographer_tools','Videographer','Creates automotive video and can use verified video tools.','🎬',true,true),
 ('media_contributor','Media Contributor','Documents vehicles, events, or the community through media coverage.','📰',true,true),
 ('reviewer_tools','Reviewer','Creates structured reviews of vehicles, parts, products, or services.','📝',true,true),
 ('journalist_tools','Journalist','Produces automotive reporting or editorial coverage.','🗞️',true,true),
 ('builder_tools','Builder','Documents and contributes hands-on build expertise.','🔧',true,true),
 ('organizer_tools','Organizer','Organizes eligible automotive events or community activity.','🎉',true,true),
 ('mentor_tools','Mentor','Contributes educational or mentoring content and support.','🤝',true,true),
 ('ambassador_tools','Ambassador','Represents Hot Flash or approved community initiatives.','🏁',true,true),
 ('featured_content_eligible','Featured Eligible','May submit original work for featured discovery placement.','🔥',true,false),
 ('premium_media_limits','Expanded Media','Receives expanded media limits and advanced media organization.','📚',true,false),
 ('advanced_profile_tools','Advanced Profile','Receives advanced profile and portfolio presentation tools.','✨',true,false),
 ('member_analytics','Member Analytics','Receives advanced garage, media, and audience analytics.','📊',true,false),
 ('early_access','Early Access','May access selected beta tools before general release.','🧪',true,false),
 ('priority_support','Priority Support','Receives priority support routing.','🛟',true,false)
on conflict(code) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,verified_only=excluded.verified_only,is_public_tag=excluded.is_public_tag,is_active=true;

create table if not exists public.member_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability_code text not null references public.member_capability_types(code) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  note text,
  is_active boolean not null default true,
  primary key(user_id,capability_code)
);

create index if not exists member_capabilities_user_idx on public.member_capabilities(user_id,is_active);
alter table public.member_capability_types enable row level security;
alter table public.member_capabilities enable row level security;

drop policy if exists "Anyone can view active capability types" on public.member_capability_types;
create policy "Anyone can view active capability types" on public.member_capability_types for select to anon,authenticated using(is_active);

drop policy if exists "Anyone can view public member tags" on public.member_capabilities;
create policy "Anyone can view public member tags" on public.member_capabilities for select to anon,authenticated using(
  is_active and (expires_at is null or expires_at > now()) and exists(
    select 1 from public.member_capability_types t where t.code=capability_code and t.is_active and t.is_public_tag
  )
);

drop policy if exists "Members view own capabilities" on public.member_capabilities;
create policy "Members view own capabilities" on public.member_capabilities for select to authenticated using(user_id=auth.uid());

create or replace function public.has_member_capability(p_code text,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.member_capabilities c
    join public.member_capability_types t on t.code=c.capability_code
    join public.profiles p on p.id=c.user_id
    where c.user_id=p_user_id and c.capability_code=p_code and c.is_active
      and (c.expires_at is null or c.expires_at>now()) and t.is_active
      and (not t.verified_only or (p.member_tier='verified' and p.verified_membership_status='active' and p.is_verified=true))
  );
$$;

create or replace function public.admin_set_verified_member(p_user_id uuid,p_active boolean,p_expires_at timestamptz default null)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  update public.profiles set
    is_verified=p_active,
    verified_at=case when p_active then coalesce(verified_at,now()) else verified_at end,
    member_tier=case when p_active then 'verified' else 'free' end,
    verified_membership_status=case when p_active then 'active' else 'revoked' end,
    verified_membership_started_at=case when p_active then coalesce(verified_membership_started_at,now()) else verified_membership_started_at end,
    verified_membership_expires_at=case when p_active then p_expires_at else now() end
  where id=p_user_id returning * into v_profile;
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if p_active then
    insert into public.member_capabilities(user_id,capability_code,granted_by,note)
    select p_user_id,t.code,auth.uid(),'Default Verified capability'
    from public.member_capability_types t
    where t.code in ('creator_tools','featured_content_eligible','premium_media_limits','advanced_profile_tools','member_analytics','early_access','priority_support')
    on conflict(user_id,capability_code) do update set is_active=true,granted_by=auth.uid(),granted_at=now(),expires_at=null;
  else
    update public.member_capabilities set is_active=false where user_id=p_user_id and capability_code in (
      select code from public.member_capability_types where verified_only
    );
  end if;
  return v_profile;
end;$$;

create or replace function public.admin_set_member_capability(p_user_id uuid,p_code text,p_active boolean,p_note text default null)
returns public.member_capabilities language plpgsql security definer set search_path=public as $$
declare v_row public.member_capabilities;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.member_capability_types where code=p_code and is_active) then raise exception 'Unknown capability'; end if;
  insert into public.member_capabilities(user_id,capability_code,granted_by,note,is_active)
  values(p_user_id,p_code,auth.uid(),nullif(trim(p_note),''),p_active)
  on conflict(user_id,capability_code) do update set granted_by=auth.uid(),granted_at=now(),note=excluded.note,is_active=p_active
  returning * into v_row;
  return v_row;
end;$$;

grant execute on function public.has_member_capability(text,uuid) to anon,authenticated;
grant execute on function public.admin_set_verified_member(uuid,boolean,timestamptz) to authenticated;
grant execute on function public.admin_set_member_capability(uuid,text,boolean,text) to authenticated;

comment on table public.member_capabilities is 'Verified-member tools and public contribution tags. Creator, photographer, media, and similar labels are capabilities, not account types.';