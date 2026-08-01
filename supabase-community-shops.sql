-- Hot Flash Community Shops foundation
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists community_standing text not null default 'good'
    check (community_standing in ('good','restricted','suspended'));

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  banner_url text,
  website_url text,
  phone text,
  email text,
  location text,
  services text[] not null default '{}',
  tier text not null default 'free'
    check (tier in ('free','pro')),
  verification_method text not null
    check (verification_method in ('verified_profile','business_identifier')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','suspended')),
  business_identifier_country text,
  business_identifier_type text,
  business_identifier_last4 text,
  verified_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager'
    check (role in ('owner','manager','event_staff')),
  status text not null default 'active'
    check (status in ('invited','active','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (shop_id,user_id)
);

create table if not exists public.shop_capabilities (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  can_host_events boolean not null default true,
  can_moderate_own_events boolean not null default true,
  can_submit_incident_reports boolean not null default true,
  can_award_event_badges boolean not null default true,
  can_verify_work boolean not null default true,
  can_sell boolean not null default false,
  can_offer_etuning boolean not null default false,
  can_receive_marketing_perks boolean not null default false,
  can_use_referral_wallet boolean not null default false,
  can_use_advanced_analytics boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops(owner_user_id);
create index if not exists shops_status_idx on public.shops(verification_status,tier);
create index if not exists shop_members_user_idx on public.shop_members(user_id,status);

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_capabilities enable row level security;

drop policy if exists "Public can view verified public shops" on public.shops;
create policy "Public can view verified public shops"
on public.shops for select
to anon, authenticated
using (is_public = true and verification_status = 'verified');

drop policy if exists "Shop members can view their shops" on public.shops;
create policy "Shop members can view their shops"
on public.shops for select
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.shop_members sm
    where sm.shop_id = shops.id and sm.user_id = auth.uid() and sm.status = 'active'
  )
);

drop policy if exists "Shop owner can update shop" on public.shops;
create policy "Shop owner can update shop"
on public.shops for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "Members can view shop membership" on public.shop_members;
create policy "Members can view shop membership"
on public.shop_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid())
);

drop policy if exists "Public can view verified shop capabilities" on public.shop_capabilities;
create policy "Public can view verified shop capabilities"
on public.shop_capabilities for select
to anon, authenticated
using (
  exists (
    select 1 from public.shops s
    where s.id = shop_id and s.is_public = true and s.verification_status = 'verified'
  )
  or exists (
    select 1 from public.shop_members sm
    where sm.shop_id = shop_capabilities.shop_id and sm.user_id = auth.uid() and sm.status = 'active'
  )
);

create or replace function public.create_community_shop(
  p_name text,
  p_slug text,
  p_description text default null,
  p_verification_method text default 'verified_profile',
  p_business_country text default null,
  p_business_identifier_type text default null,
  p_business_identifier_last4 text default null
)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_shop public.shops;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Create your personal profile first'; end if;
  if v_profile.community_standing <> 'good' then raise exception 'Your account is not currently eligible to create a shop'; end if;
  if p_verification_method not in ('verified_profile','business_identifier') then raise exception 'Invalid verification method'; end if;
  if p_verification_method = 'verified_profile' and not coalesce(v_profile.is_verified,false) then
    raise exception 'Your personal profile must be verified before linking a shop';
  end if;
  if p_verification_method = 'business_identifier' and nullif(trim(p_business_identifier_last4),'') is null then
    raise exception 'Enter the final four characters of the business identifier';
  end if;
  if length(trim(p_name)) < 2 then raise exception 'Shop name is too short'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$' then raise exception 'Invalid shop address'; end if;

  insert into public.shops(
    owner_user_id,name,slug,description,verification_method,
    verification_status,business_identifier_country,business_identifier_type,business_identifier_last4
  ) values (
    auth.uid(),trim(p_name),lower(trim(p_slug)),nullif(trim(p_description),''),p_verification_method,
    case when p_verification_method='verified_profile' then 'verified' else 'pending' end,
    nullif(trim(p_business_country),''),nullif(trim(p_business_identifier_type),''),nullif(trim(p_business_identifier_last4),'')
  ) returning * into v_shop;

  insert into public.shop_members(shop_id,user_id,role,status,invited_by)
  values (v_shop.id,auth.uid(),'owner','active',auth.uid());

  insert into public.shop_capabilities(shop_id)
  values (v_shop.id);

  return v_shop;
end;
$$;

create or replace function public.set_shop_tier(p_shop_id uuid,p_tier text)
returns public.shop_capabilities
language plpgsql
security definer
set search_path = public
as $$
declare v_caps public.shop_capabilities;
begin
  if not exists(select 1 from public.shops where id=p_shop_id and owner_user_id=auth.uid()) then
    raise exception 'Only the shop owner can change the shop tier';
  end if;
  if p_tier not in ('free','pro') then raise exception 'Invalid shop tier'; end if;

  update public.shops set tier=p_tier,updated_at=now() where id=p_shop_id;
  update public.shop_capabilities set
    can_sell=(p_tier='pro'),
    can_offer_etuning=(p_tier='pro'),
    can_receive_marketing_perks=(p_tier='pro'),
    can_use_referral_wallet=(p_tier='pro'),
    can_use_advanced_analytics=(p_tier='pro'),
    updated_at=now()
  where shop_id=p_shop_id
  returning * into v_caps;
  return v_caps;
end;
$$;

grant execute on function public.create_community_shop(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.set_shop_tier(uuid,text) to authenticated;

comment on table public.shops is 'Community Shop pages backed by either a verified personal profile or a verified business identifier.';
comment on table public.shop_capabilities is 'Free shops receive community-steward and event tools; monetization and marketing capabilities require Shop Pro.';