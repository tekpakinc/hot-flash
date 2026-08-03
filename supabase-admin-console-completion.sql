-- Hot Flash Admin Console completion foundation
-- Adds dashboard metrics, searchable user operations, and editable dropdown data.

create table if not exists public.hotflash_user_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','restricted')),
  reason text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.hotflash_user_status enable row level security;

create table if not exists public.vehicle_catalog_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('make','model','engine','color','fuel_type','body_style','drivetrain','transmission','vehicle_class')),
  label text not null,
  parent_label text,
  vehicle_type text not null default 'automobile',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, label, parent_label, vehicle_type)
);

create index if not exists vehicle_catalog_options_lookup_idx
  on public.vehicle_catalog_options(category, vehicle_type, parent_label, active, sort_order, label);

alter table public.vehicle_catalog_options enable row level security;

drop policy if exists "Catalog options publicly readable" on public.vehicle_catalog_options;
create policy "Catalog options publicly readable" on public.vehicle_catalog_options
for select using (active = true or public.is_hotflash_admin());

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'vehicles', (select count(*) from public.vehicles),
    'shops', (select count(*) from public.shops),
    'hoon_posts', (select count(*) from public.hoon_posts),
    'events', (select count(*) from public.events),
    'verified_members', (select count(distinct user_id) from public.user_capabilities where capability_key = 'verified_member' and enabled = true),
    'open_orders', (select count(*) from public.flashtag_orders where status not in ('completed','cancelled')),
    'open_feedback', (select count(*) from public.feedback where status not in ('fixed','closed')),
    'new_users_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_vehicles_today', (select count(*) from public.vehicles where created_at >= date_trunc('day', now())),
    'new_orders_today', (select count(*) from public.flashtag_orders where created_at >= date_trunc('day', now()))
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_search_users(p_query text default null, p_limit integer default 50)
returns table(
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  account_status text,
  status_reason text,
  vehicle_count bigint,
  shop_count bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    p.username,
    p.display_name,
    p.avatar_url,
    u.created_at,
    u.last_sign_in_at,
    coalesce(s.status, 'active'),
    s.reason,
    (select count(*) from public.vehicles v where v.owner_id = u.id),
    (select count(*) from public.shops sh where sh.owner_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.hotflash_user_status s on s.user_id = u.id
  where public.is_hotflash_admin()
    and (
      nullif(trim(p_query), '') is null
      or lower(coalesce(u.email,'')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(p.username,'')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(p.display_name,'')) like '%' || lower(trim(p_query)) || '%'
      or u.id::text = trim(p_query)
    )
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('active','suspended','restricted') then raise exception 'Invalid account status'; end if;
  insert into public.hotflash_user_status(user_id,status,reason,updated_by,updated_at)
  values(p_user_id,p_status,nullif(trim(p_reason),''),auth.uid(),now())
  on conflict(user_id) do update set status=excluded.status,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now();
end;
$$;

create or replace function public.admin_list_catalog_options(p_category text default null, p_vehicle_type text default null)
returns setof public.vehicle_catalog_options
language sql
security definer
set search_path = public
as $$
  select * from public.vehicle_catalog_options
  where public.is_hotflash_admin()
    and (p_category is null or category = p_category)
    and (p_vehicle_type is null or vehicle_type = p_vehicle_type)
  order by category, vehicle_type, parent_label nulls first, sort_order, label;
$$;

create or replace function public.admin_upsert_catalog_option(
  p_id uuid default null,
  p_category text default null,
  p_label text default null,
  p_parent_label text default null,
  p_vehicle_type text default 'automobile',
  p_sort_order integer default 0,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  if nullif(trim(p_label),'') is null then raise exception 'Label is required'; end if;
  if p_category not in ('make','model','engine','color','fuel_type','body_style','drivetrain','transmission','vehicle_class') then raise exception 'Invalid category'; end if;
  if p_id is null then
    insert into public.vehicle_catalog_options(category,label,parent_label,vehicle_type,sort_order,active)
    values(p_category,trim(p_label),nullif(trim(p_parent_label),''),coalesce(nullif(trim(p_vehicle_type),''),'automobile'),coalesce(p_sort_order,0),coalesce(p_active,true))
    returning id into result_id;
  else
    update public.vehicle_catalog_options set
      category=p_category,label=trim(p_label),parent_label=nullif(trim(p_parent_label),''),
      vehicle_type=coalesce(nullif(trim(p_vehicle_type),''),'automobile'),sort_order=coalesce(p_sort_order,0),
      active=coalesce(p_active,true),updated_at=now()
    where id=p_id returning id into result_id;
  end if;
  return result_id;
end;
$$;

create or replace function public.admin_delete_catalog_option(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  delete from public.vehicle_catalog_options where id=p_id;
end;
$$;

grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_search_users(text,integer) to authenticated;
grant execute on function public.admin_set_user_status(uuid,text,text) to authenticated;
grant execute on function public.admin_list_catalog_options(text,text) to authenticated;
grant execute on function public.admin_upsert_catalog_option(uuid,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.admin_delete_catalog_option(uuid) to authenticated;
grant select on public.vehicle_catalog_options to anon, authenticated;
