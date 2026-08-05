-- Hot Flash visible comment/journal unification
-- Run after supabase-universal-comments.sql.

alter table public.hotflash_comments drop constraint if exists hotflash_comments_subject_type_check;
alter table public.hotflash_comments add constraint hotflash_comments_subject_type_check
  check (subject_type in ('hoon','vehicle','vehicle_image','shop','member','event','build_update'));

alter table public.posts add column if not exists updated_at timestamptz;

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
do $$ begin
 if to_regclass('public.post_comments') is not null then
  insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
  select c.id,'build_update',c.post_id,c.author_id,left(c.body,500),c.created_at,
         case when to_jsonb(c)?'updated_at' then nullif(to_jsonb(c)->>'updated_at','')::timestamptz else null end
  from public.post_comments c
  where not exists(select 1 from public.hotflash_comments h where h.id=c.id)
  on conflict(id) do nothing;
 end if;
end $$;

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
 if to_regclass('public.post_comments') is not null then
  drop trigger if exists sync_post_comment_universal on public.post_comments;
  create trigger sync_post_comment_universal after insert or update or delete on public.post_comments
  for each row execute function public.sync_legacy_comment_to_universal('build_update');
 end if;
end $$;
