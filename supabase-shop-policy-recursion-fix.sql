-- Hot Flash Community Shop RLS recursion fix
-- Safe to run after the Community Shops and Shop Management migrations.
-- Replaces policies that queried shops <-> shop_members recursively.

create or replace function public.is_active_shop_member(
  p_shop_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and (p_roles is null or sm.role = any(p_roles))
  );
$$;

create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_active_shop_member(uuid,text[]) from public;
revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_active_shop_member(uuid,text[]) to anon, authenticated;
grant execute on function public.is_shop_owner(uuid) to authenticated;

-- SHOPS ---------------------------------------------------------------
drop policy if exists "Public can view verified public shops" on public.shops;
drop policy if exists "Shop members can view their shops" on public.shops;
drop policy if exists "Shop owner can update shop" on public.shops;
drop policy if exists "Shop staff can update shop" on public.shops;

create policy "Public can view verified public shops"
on public.shops for select
to anon, authenticated
using (is_public = true and verification_status = 'verified');

create policy "Shop members can view their shops"
on public.shops for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_active_shop_member(id, null)
);

create policy "Shop owner can update shop"
on public.shops for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- SHOP MEMBERS --------------------------------------------------------
drop policy if exists "Members can view shop membership" on public.shop_members;
drop policy if exists "Shop owners manage membership" on public.shop_members;
drop policy if exists "Shop staff can view membership" on public.shop_members;

create policy "Members can view shop membership"
on public.shop_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_shop_owner(shop_id)
  or public.is_active_shop_member(shop_id, array['owner','manager']::text[])
);

-- Membership writes continue through the security-definer RPCs
-- add_shop_member() and remove_shop_member(), avoiding broad direct writes.

-- SHOP CAPABILITIES ---------------------------------------------------
drop policy if exists "Public can view verified shop capabilities" on public.shop_capabilities;
drop policy if exists "Shop members can view capabilities" on public.shop_capabilities;

create policy "Public can view verified shop capabilities"
on public.shop_capabilities for select
to anon, authenticated
using (
  exists (
    select 1
    from public.shops s
    where s.id = shop_capabilities.shop_id
      and s.is_public = true
      and s.verification_status = 'verified'
  )
  or public.is_active_shop_member(shop_id, null)
);

-- STORAGE -------------------------------------------------------------
-- Use the non-recursive helper instead of querying shop_members directly.
drop policy if exists "Shop staff upload shop media" on storage.objects;
create policy "Shop staff upload shop media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'shop-media'
  and public.is_active_shop_member(
    ((storage.foldername(name))[1])::uuid,
    array['owner','manager']::text[]
  )
);

drop policy if exists "Shop staff update shop media" on storage.objects;
create policy "Shop staff update shop media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'shop-media'
  and public.is_active_shop_member(
    ((storage.foldername(name))[1])::uuid,
    array['owner','manager']::text[]
  )
)
with check (
  bucket_id = 'shop-media'
  and public.is_active_shop_member(
    ((storage.foldername(name))[1])::uuid,
    array['owner','manager']::text[]
  )
);

drop policy if exists "Shop staff delete shop media" on storage.objects;
create policy "Shop staff delete shop media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'shop-media'
  and public.is_active_shop_member(
    ((storage.foldername(name))[1])::uuid,
    array['owner','manager']::text[]
  )
);
