-- Hot Flash shop-post distribution rules
-- Free shops may publish to their own page and followers.
-- Only Shop Pro posts qualify for the broad Discover feed.

alter table public.posts
  add column if not exists shop_id uuid references public.shops(id) on delete cascade;

create index if not exists posts_shop_created_idx
  on public.posts(shop_id, created_at desc)
  where shop_id is not null;

create or replace function public.create_shop_post(
  p_shop_id uuid,
  p_body text,
  p_image_url text default null
)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.posts;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 3000 then
    raise exception 'Shop post must be between 1 and 3000 characters.';
  end if;

  if not exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner','manager')
  ) then
    raise exception 'Only an active shop owner or manager can publish for this shop.';
  end if;

  insert into public.posts(author_id, shop_id, body, image_url)
  values (auth.uid(), p_shop_id, trim(p_body), nullif(trim(coalesce(p_image_url, '')), ''))
  returning * into r;

  return r;
end;
$$;

grant execute on function public.create_shop_post(uuid,text,text) to authenticated;

create or replace function public.shop_post_is_discover_eligible(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_shop_id is null then true
    else exists (
      select 1
      from public.shops s
      where s.id = p_shop_id
        and s.tier = 'pro'
        and coalesce(s.verification_status, 'pending') <> 'suspended'
    )
  end;
$$;

grant execute on function public.shop_post_is_discover_eligible(uuid) to anon, authenticated;
