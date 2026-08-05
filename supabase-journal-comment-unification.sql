-- Hot Flash visible comment/journal unification
-- Run after supabase-universal-comments.sql.
-- Safe to rerun. Creates the legacy Build Journal foundation when it is absent.

alter table public.hotflash_comments drop constraint if exists hotflash_comments_subject_type_check;
alter table public.hotflash_comments add constraint hotflash_comments_subject_type_check
  check (subject_type in ('hoon','vehicle','vehicle_image','shop','member','event','build_update'));

-- Build Journal foundation used by social.js.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 3000),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists posts_vehicle_created_idx on public.posts(vehicle_id,created_at desc);
create index if not exists posts_author_created_idx on public.posts(author_id,created_at desc);
alter table public.posts enable row level security;
drop policy if exists "Build updates are publicly readable" on public.posts;
create policy "Build updates are publicly readable" on public.posts for select to anon,authenticated using(true);
drop policy if exists "Vehicle owners create build updates" on public.posts;
create policy "Vehicle owners create build updates" on public.posts for insert to authenticated
with check(author_id=auth.uid() and exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=auth.uid()));
drop policy if exists "Authors update build updates" on public.posts;
create policy "Authors update build updates" on public.posts for update to authenticated
using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists "Authors delete build updates" on public.posts;
create policy "Authors delete build updates" on public.posts for delete to authenticated
using(author_id=auth.uid() or public.is_hotflash_admin());

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "Post likes are readable" on public.post_likes;
create policy "Post likes are readable" on public.post_likes for select to anon,authenticated using(true);
drop policy if exists "Members manage own post likes" on public.post_likes;
create policy "Members manage own post likes" on public.post_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "Members remove own post likes" on public.post_likes;
create policy "Members remove own post likes" on public.post_likes for delete to authenticated using(user_id=auth.uid());

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists post_comments_post_created_idx on public.post_comments(post_id,created_at);
alter table public.post_comments enable row level security;
drop policy if exists "Post comments are readable" on public.post_comments;
create policy "Post comments are readable" on public.post_comments for select to anon,authenticated using(true);
drop policy if exists "Members create own post comments" on public.post_comments;
create policy "Members create own post comments" on public.post_comments for insert to authenticated with check(author_id=auth.uid());
drop policy if exists "Authors update own post comments" on public.post_comments;
create policy "Authors update own post comments" on public.post_comments for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists "Authors delete own post comments" on public.post_comments;
create policy "Authors delete own post comments" on public.post_comments for delete to authenticated using(author_id=auth.uid() or public.is_hotflash_admin());

grant select on public.posts,public.post_likes,public.post_comments to anon,authenticated;
grant insert,update,delete on public.posts,public.post_likes,public.post_comments to authenticated;

create or replace function public.update_build_journal_post(p_post_id uuid,p_body text)
returns public.posts language plpgsql security definer set search_path=public as $$
declare r public.posts;
begin
 if char_length(trim(coalesce(p_body,''))) not between 1 and 3000 then raise exception 'Build update must be between 1 and 3000 characters'; end if;
 update public.posts set body=trim(p_body),updated_at=now()
 where id=p_post_id and author_id=auth.uid() returning * into r;
 if r.id is null then raise exception 'Only the author can edit this build update'; end if;
 return r;
end $$;

create or replace function public.delete_build_journal_post(p_post_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.posts where id=p_post_id and (author_id=auth.uid() or public.is_hotflash_admin());
 if not found then raise exception 'Only the author can delete this build update'; end if;
end $$;

grant execute on function public.update_build_journal_post(uuid,text) to authenticated;
grant execute on function public.delete_build_journal_post(uuid) to authenticated;

-- Import existing vehicle discussion comments.
do $$ begin
 if to_regclass('public.vehicle_comments') is not null then
  insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
  select c.id,'vehicle',c.vehicle_id,c.author_id,left(c.body,500),c.created_at,
         case when to_jsonb(c)?'updated_at' then nullif(to_jsonb(c)->>'updated_at','')::timestamptz else null end
  from public.vehicle_comments c
  where not exists(select 1 from public.hotflash_comments h where h.id=c.id)
  on conflict(id) do nothing;
 end if;
end $$;

-- Import existing photo comments.
do $$ begin
 if to_regclass('public.vehicle_image_comments') is not null then
  insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
  select c.id,'vehicle_image',c.image_id,c.author_id,left(c.body,500),c.created_at,
         case when to_jsonb(c)?'updated_at' then nullif(to_jsonb(c)->>'updated_at','')::timestamptz else null end
  from public.vehicle_image_comments c
  where not exists(select 1 from public.hotflash_comments h where h.id=c.id)
  on conflict(id) do nothing;
 end if;
end $$;

-- Import existing build-update comments.
insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
select c.id,'build_update',c.post_id,c.author_id,left(c.body,500),c.created_at,c.updated_at
from public.post_comments c
where not exists(select 1 from public.hotflash_comments h where h.id=c.id)
on conflict(id) do nothing;

create or replace function public.sync_legacy_comment_to_universal() returns trigger
language plpgsql security definer set search_path=public as $$
declare kind text; subject uuid;
begin
 kind := tg_argv[0];
 if kind='vehicle' then subject:=coalesce(new.vehicle_id,old.vehicle_id);
 elsif kind='vehicle_image' then subject:=coalesce(new.image_id,old.image_id);
 else subject:=coalesce(new.post_id,old.post_id); end if;
 if tg_op='DELETE' then update public.hotflash_comments set deleted_at=now() where id=old.id; return old; end if;
 insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
 values(new.id,kind,subject,new.author_id,left(new.body,500),new.created_at,
        case when to_jsonb(new)?'updated_at' then nullif(to_jsonb(new)->>'updated_at','')::timestamptz else null end)
 on conflict(id) do update set body=excluded.body,updated_at=coalesce(excluded.updated_at,now()),deleted_at=null;
 return new;
end $$;

do $$ begin
 if to_regclass('public.vehicle_comments') is not null then
  drop trigger if exists sync_vehicle_comment_universal on public.vehicle_comments;
  create trigger sync_vehicle_comment_universal after insert or update or delete on public.vehicle_comments
  for each row execute function public.sync_legacy_comment_to_universal('vehicle');
 end if;
 if to_regclass('public.vehicle_image_comments') is not null then
  drop trigger if exists sync_vehicle_image_comment_universal on public.vehicle_image_comments;
  create trigger sync_vehicle_image_comment_universal after insert or update or delete on public.vehicle_image_comments
  for each row execute function public.sync_legacy_comment_to_universal('vehicle_image');
 end if;
 drop trigger if exists sync_post_comment_universal on public.post_comments;
 create trigger sync_post_comment_universal after insert or update or delete on public.post_comments
 for each row execute function public.sync_legacy_comment_to_universal('build_update');
end $$;
