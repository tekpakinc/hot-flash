-- Hot Flash launch follow + notification foundation
-- Preserves existing member/vehicle follow tables while adding universal follows.

create table if not exists public.hotflash_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null check (subject_type in ('member','vehicle','shop','event')),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, subject_type, subject_id)
);
create index if not exists hotflash_follows_subject_idx on public.hotflash_follows(subject_type, subject_id, created_at desc);
create index if not exists hotflash_follows_user_idx on public.hotflash_follows(follower_id, created_at desc);
alter table public.hotflash_follows enable row level security;

drop policy if exists "Public follow counts" on public.hotflash_follows;
create policy "Public follow counts" on public.hotflash_follows for select to anon,authenticated using (true);
drop policy if exists "Members manage own follows" on public.hotflash_follows;
create policy "Members manage own follows" on public.hotflash_follows for all to authenticated
using (follower_id=auth.uid()) with check (follower_id=auth.uid());

-- Add flexible notification routing fields without disturbing existing notification data.
alter table public.notifications add column if not exists subject_type text;
alter table public.notifications add column if not exists subject_id uuid;
alter table public.notifications add column if not exists target_url text;
alter table public.notifications add column if not exists read_at timestamptz;

create or replace function public.hotflash_subject_owner(p_type text,p_id uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare owner_id uuid;
begin
 if p_type='member' then return p_id; end if;
 if p_type='vehicle' and to_regclass('public.vehicles') is not null then
  select v.owner_id into owner_id from public.vehicles v where v.id=p_id;
 elsif p_type='shop' and to_regclass('public.shop_members') is not null then
  select sm.user_id into owner_id from public.shop_members sm
  where sm.shop_id=p_id and sm.role='owner' and coalesce(sm.status,'active')='active' limit 1;
 elsif p_type='event' and to_regclass('public.events') is not null then
  execute 'select coalesce((to_jsonb(e)->>''organizer_id'')::uuid,(to_jsonb(e)->>''owner_id'')::uuid,(to_jsonb(e)->>''created_by'')::uuid) from public.events e where e.id=$1'
    into owner_id using p_id;
 end if;
 return owner_id;
end $$;

create or replace function public.toggle_hotflash_follow(p_subject_type text,p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare now_following boolean; total bigint; recipient uuid; label text; url text;
begin
 if auth.uid() is null then raise exception 'Sign in to follow'; end if;
 if p_subject_type not in ('member','vehicle','shop','event') then raise exception 'Unsupported follow type'; end if;
 recipient:=public.hotflash_subject_owner(p_subject_type,p_subject_id);
 if recipient=auth.uid() then raise exception 'You cannot follow your own page'; end if;
 if exists(select 1 from public.hotflash_follows where follower_id=auth.uid() and subject_type=p_subject_type and subject_id=p_subject_id) then
  delete from public.hotflash_follows where follower_id=auth.uid() and subject_type=p_subject_type and subject_id=p_subject_id;
  now_following:=false;
 else
  insert into public.hotflash_follows(follower_id,subject_type,subject_id) values(auth.uid(),p_subject_type,p_subject_id)
  on conflict do nothing;
  now_following:=true;
  label:=case p_subject_type when 'member' then 'started following you' when 'vehicle' then 'followed your vehicle' when 'shop' then 'followed your shop' else 'followed your event' end;
  url:=case p_subject_type when 'member' then 'member.html?id='||p_subject_id when 'vehicle' then 'vehicle.html?id='||p_subject_id when 'shop' then 'shop.html?id='||p_subject_id else 'events.html?id='||p_subject_id end;
  if recipient is not null and recipient<>auth.uid() then
   insert into public.notifications(recipient_id,actor_id,type,message,subject_type,subject_id,target_url)
   values(recipient,auth.uid(),p_subject_type||'_follow',label,p_subject_type,p_subject_id,url);
  end if;
 end if;
 select count(*) into total from public.hotflash_follows where subject_type=p_subject_type and subject_id=p_subject_id;
 return jsonb_build_object('following',now_following,'count',total);
end $$;

grant execute on function public.toggle_hotflash_follow(text,uuid) to authenticated;
grant execute on function public.hotflash_subject_owner(text,uuid) to anon,authenticated;

create or replace function public.get_hotflash_follow_state(p_subject_type text,p_subject_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'following', auth.uid() is not null and exists(select 1 from public.hotflash_follows where follower_id=auth.uid() and subject_type=p_subject_type and subject_id=p_subject_id),
  'count', (select count(*) from public.hotflash_follows where subject_type=p_subject_type and subject_id=p_subject_id)
 )
$$;
grant execute on function public.get_hotflash_follow_state(text,uuid) to anon,authenticated;

-- Backfill existing follows when those legacy tables exist.
do $$ begin
 if to_regclass('public.profile_followers') is not null then
  insert into public.hotflash_follows(follower_id,subject_type,subject_id)
  select follower_id,'member',profile_id from public.profile_followers on conflict do nothing;
 end if;
 if to_regclass('public.vehicle_followers') is not null then
  insert into public.hotflash_follows(follower_id,subject_type,subject_id)
  select user_id,'vehicle',vehicle_id from public.vehicle_followers on conflict do nothing;
 end if;
end $$;

create or replace function public.sync_legacy_follow_to_universal() returns trigger
language plpgsql security definer set search_path=public as $$
declare kind text:=tg_argv[0]; follower uuid; subject uuid;
begin
 if kind='member' then follower:=coalesce(new.follower_id,old.follower_id); subject:=coalesce(new.profile_id,old.profile_id);
 else follower:=coalesce(new.user_id,old.user_id); subject:=coalesce(new.vehicle_id,old.vehicle_id); end if;
 if tg_op='DELETE' then delete from public.hotflash_follows where follower_id=follower and subject_type=kind and subject_id=subject; return old; end if;
 insert into public.hotflash_follows(follower_id,subject_type,subject_id) values(follower,kind,subject) on conflict do nothing;
 return new;
end $$;

do $$ begin
 if to_regclass('public.profile_followers') is not null then
  drop trigger if exists sync_profile_follow_universal on public.profile_followers;
  create trigger sync_profile_follow_universal after insert or delete on public.profile_followers
  for each row execute function public.sync_legacy_follow_to_universal('member');
 end if;
 if to_regclass('public.vehicle_followers') is not null then
  drop trigger if exists sync_vehicle_follow_universal on public.vehicle_followers;
  create trigger sync_vehicle_follow_universal after insert or delete on public.vehicle_followers
  for each row execute function public.sync_legacy_follow_to_universal('vehicle');
 end if;
end $$;

create or replace function public.get_hotflash_following_feed(p_limit integer default 50)
returns table(post_id uuid,author_id uuid,vehicle_id uuid,body text,image_url text,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then return; end if;
 if to_regclass('public.posts') is null then return; end if;
 return query execute $q$
  select p.id,p.author_id,p.vehicle_id,p.body,p.image_url,p.created_at,
         nullif(to_jsonb(p)->>'updated_at','')::timestamptz
  from public.posts p
  where exists(select 1 from public.hotflash_follows f where f.follower_id=auth.uid() and ((f.subject_type='member' and f.subject_id=p.author_id) or (f.subject_type='vehicle' and f.subject_id=p.vehicle_id)))
  order by p.created_at desc limit $1
 $q$ using greatest(1,least(coalesce(p_limit,50),100));
end $$;
grant execute on function public.get_hotflash_following_feed(integer) to authenticated;
