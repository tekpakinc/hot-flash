-- Hot Flash simple admin console roles and secure FlashTag lookup
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists app_role text not null default 'member'
  check (app_role in ('member','flashtag_fulfillment','support','admin'));

create index if not exists profiles_app_role_idx on public.profiles(app_role);

create or replace function public.is_hotflash_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and app_role in ('admin','flashtag_fulfillment')
      and coalesce(community_standing,'good') <> 'suspended'
  );
$$;

revoke all on function public.is_hotflash_admin() from public;
grant execute on function public.is_hotflash_admin() to authenticated;

create or replace function public.admin_get_flashtag_vehicle(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
  v_profile public.profiles;
  v_ref text := trim(coalesce(p_reference,''));
begin
  if not public.is_hotflash_admin() then
    raise exception 'You do not have FlashTag fulfillment access';
  end if;

  if v_ref = '' then
    raise exception 'Enter a Hot Flash ID or vehicle UUID';
  end if;

  select * into v_vehicle
  from public.vehicles
  where hotflash_id = upper(v_ref)
     or id::text = v_ref
  limit 1;

  if v_vehicle.id is null then
    raise exception 'Vehicle not found';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_vehicle.owner_id;

  return jsonb_build_object(
    'vehicle', to_jsonb(v_vehicle),
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'display_name', v_profile.display_name
    )
  );
end;
$$;

revoke all on function public.admin_get_flashtag_vehicle(text) from public;
grant execute on function public.admin_get_flashtag_vehicle(text) to authenticated;

comment on column public.profiles.app_role is 'Application permission role. Manage in Supabase Table Editor or with an UPDATE statement.';
comment on function public.admin_get_flashtag_vehicle(text) is 'Securely returns the permanent vehicle identity needed to render an existing FlashTag for authorized fulfillment staff.';