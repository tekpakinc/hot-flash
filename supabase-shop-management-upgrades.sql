-- Hot Flash Community Shop management upgrades
-- Safe to run after supabase-community-shops.sql and supabase-shops-hoonpad.sql.

alter table public.shops
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists hours_text text,
  add column if not exists specialties text[] not null default '{}';

-- Preserve data from the original email/phone columns where present.
update public.shops set contact_email=coalesce(contact_email,email) where contact_email is null;
update public.shops set contact_phone=coalesce(contact_phone,phone) where contact_phone is null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('shop-media','shop-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public can view shop media" on storage.objects;
create policy "Public can view shop media" on storage.objects for select to public
using (bucket_id='shop-media');

drop policy if exists "Shop staff upload shop media" on storage.objects;
create policy "Shop staff upload shop media" on storage.objects for insert to authenticated
with check (
  bucket_id='shop-media' and exists (
    select 1 from public.shop_members sm
    where sm.shop_id::text=(storage.foldername(name))[1]
      and sm.user_id=auth.uid() and sm.status='active' and sm.role in ('owner','manager')
  )
);

drop policy if exists "Shop staff update shop media" on storage.objects;
create policy "Shop staff update shop media" on storage.objects for update to authenticated
using (
  bucket_id='shop-media' and exists (
    select 1 from public.shop_members sm
    where sm.shop_id::text=(storage.foldername(name))[1]
      and sm.user_id=auth.uid() and sm.status='active' and sm.role in ('owner','manager')
  )
);

drop policy if exists "Shop staff delete shop media" on storage.objects;
create policy "Shop staff delete shop media" on storage.objects for delete to authenticated
using (
  bucket_id='shop-media' and exists (
    select 1 from public.shop_members sm
    where sm.shop_id::text=(storage.foldername(name))[1]
      and sm.user_id=auth.uid() and sm.status='active' and sm.role in ('owner','manager')
  )
);

create or replace function public.update_community_shop(
  p_shop_id uuid,p_description text,p_location text,p_services text[],p_specialties text[],
  p_website_url text,p_contact_email text,p_contact_phone text,p_hours_text text,
  p_logo_url text,p_banner_url text
) returns public.shops
language plpgsql security definer set search_path=public
as $$
declare v_shop public.shops;
begin
  if not exists(
    select 1 from public.shop_members sm where sm.shop_id=p_shop_id and sm.user_id=auth.uid()
      and sm.status='active' and sm.role in ('owner','manager')
  ) then raise exception 'Owner or manager access required'; end if;
  update public.shops set
    description=nullif(trim(p_description),''),location=nullif(trim(p_location),''),
    services=coalesce(p_services,'{}'),specialties=coalesce(p_specialties,'{}'),
    website_url=nullif(trim(p_website_url),''),contact_email=nullif(trim(p_contact_email),''),
    contact_phone=nullif(trim(p_contact_phone),''),hours_text=nullif(trim(p_hours_text),''),
    logo_url=nullif(trim(p_logo_url),''),banner_url=nullif(trim(p_banner_url),''),updated_at=now()
  where id=p_shop_id returning * into v_shop;
  return v_shop;
end;$$;

create or replace function public.remove_shop_member(p_shop_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.shops where id=p_shop_id and owner_user_id=auth.uid()) then
    raise exception 'Only the shop owner can remove staff';
  end if;
  if p_user_id=auth.uid() then raise exception 'The owner cannot remove themselves'; end if;
  update public.shop_members set status='removed' where shop_id=p_shop_id and user_id=p_user_id and role<>'owner';
end;$$;

grant execute on function public.update_community_shop(uuid,text,text,text[],text[],text,text,text,text,text,text) to authenticated;
grant execute on function public.remove_shop_member(uuid,uuid) to authenticated;