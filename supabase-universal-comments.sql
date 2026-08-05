-- Hot Flash universal comments
-- One editable/moderated comment system for every supported subject.

create table if not exists public.hotflash_comments (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('hoon','vehicle','shop','member','event','build_update')),
  subject_id uuid not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null
);
create index if not exists hotflash_comments_subject_idx on public.hotflash_comments(subject_type,subject_id,created_at);
create index if not exists hotflash_comments_author_idx on public.hotflash_comments(author_id,created_at desc);
alter table public.hotflash_comments enable row level security;

drop policy if exists "Visible universal comments are readable" on public.hotflash_comments;
create policy "Visible universal comments are readable" on public.hotflash_comments
for select to anon,authenticated using(deleted_at is null and hidden_at is null);

drop policy if exists "Members create own universal comments" on public.hotflash_comments;
create policy "Members create own universal comments" on public.hotflash_comments
for insert to authenticated with check(author_id=auth.uid() and deleted_at is null and hidden_at is null);

drop policy if exists "Authors update own universal comments" on public.hotflash_comments;
create policy "Authors update own universal comments" on public.hotflash_comments
for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());

drop policy if exists "Authors delete own universal comments" on public.hotflash_comments;
create policy "Authors delete own universal comments" on public.hotflash_comments
for delete to authenticated using(author_id=auth.uid() or public.is_hotflash_admin());

create table if not exists public.hotflash_comment_reports(
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.hotflash_comments(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(trim(reason)) between 3 and 300),
 status text not null default 'new' check(status in ('new','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(comment_id,reporter_id)
);
alter table public.hotflash_comment_reports enable row level security;
drop policy if exists "Members report comments" on public.hotflash_comment_reports;
create policy "Members report comments" on public.hotflash_comment_reports for insert to authenticated with check(reporter_id=auth.uid());
drop policy if exists "Members view own reports" on public.hotflash_comment_reports;
create policy "Members view own reports" on public.hotflash_comment_reports for select to authenticated using(reporter_id=auth.uid() or public.is_hotflash_admin());

create or replace function public.create_hotflash_comment(p_subject_type text,p_subject_id uuid,p_body text)
returns public.hotflash_comments language plpgsql security definer set search_path=public as $$
declare r public.hotflash_comments;
begin
 if auth.uid() is null then raise exception 'Sign in to comment'; end if;
 if p_subject_type not in ('hoon','vehicle','shop','member','event','build_update') then raise exception 'Unsupported comment area'; end if;
 if char_length(trim(coalesce(p_body,''))) not between 1 and 500 then raise exception 'Comment must be between 1 and 500 characters'; end if;
 insert into public.hotflash_comments(subject_type,subject_id,author_id,body) values(p_subject_type,p_subject_id,auth.uid(),trim(p_body)) returning * into r;
 return r;
end $$;

create or replace function public.update_hotflash_comment(p_comment_id uuid,p_body text)
returns public.hotflash_comments language plpgsql security definer set search_path=public as $$
declare r public.hotflash_comments;
begin
 if char_length(trim(coalesce(p_body,''))) not between 1 and 500 then raise exception 'Comment must be between 1 and 500 characters'; end if;
 update public.hotflash_comments set body=trim(p_body),updated_at=now() where id=p_comment_id and author_id=auth.uid() and deleted_at is null and hidden_at is null returning * into r;
 if r.id is null then raise exception 'Only the author can edit this comment'; end if;
 return r;
end $$;

create or replace function public.delete_hotflash_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.hotflash_comments set deleted_at=now() where id=p_comment_id and (author_id=auth.uid() or public.is_hotflash_admin()) and deleted_at is null;
 if not found then raise exception 'Comment could not be deleted'; end if;
end $$;

create or replace function public.report_hotflash_comment(p_comment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in to report a comment'; end if;
 insert into public.hotflash_comment_reports(comment_id,reporter_id,reason) values(p_comment_id,auth.uid(),trim(p_reason))
 on conflict(comment_id,reporter_id) do update set reason=excluded.reason,status='new',created_at=now();
end $$;

grant execute on function public.create_hotflash_comment(text,uuid,text) to authenticated;
grant execute on function public.update_hotflash_comment(uuid,text) to authenticated;
grant execute on function public.delete_hotflash_comment(uuid) to authenticated;
grant execute on function public.report_hotflash_comment(uuid,text) to authenticated;

-- Copy existing Hoon comments once. The unique test prevents repeat imports.
do $$ begin
 if to_regclass('public.hoon_comments') is not null then
  insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
  select h.id,'hoon',h.post_id,h.author_id,h.body,h.created_at,
         case when to_jsonb(h) ? 'updated_at' then nullif(to_jsonb(h)->>'updated_at','')::timestamptz else null end
  from public.hoon_comments h
  where not exists(select 1 from public.hotflash_comments c where c.id=h.id)
  on conflict(id) do nothing;
 end if;
end $$;

-- Keep the current Hoon implementation synchronized while it is migrated to the shared UI.
create or replace function public.sync_hoon_comment_to_universal() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.hotflash_comments(id,subject_type,subject_id,author_id,body,created_at,updated_at)
  values(new.id,'hoon',new.post_id,new.author_id,new.body,new.created_at,case when to_jsonb(new)?'updated_at' then nullif(to_jsonb(new)->>'updated_at','')::timestamptz else null end)
  on conflict(id) do update set body=excluded.body,updated_at=excluded.updated_at;
  return new;
 elsif tg_op='UPDATE' then
  update public.hotflash_comments set body=new.body,updated_at=coalesce(nullif(to_jsonb(new)->>'updated_at','')::timestamptz,now()) where id=new.id;
  return new;
 else
  update public.hotflash_comments set deleted_at=now() where id=old.id;
  return old;
 end if;
end $$;

do $$ begin
 if to_regclass('public.hoon_comments') is not null then
  drop trigger if exists sync_hoon_comment_to_universal_trigger on public.hoon_comments;
  create trigger sync_hoon_comment_to_universal_trigger after insert or update or delete on public.hoon_comments for each row execute function public.sync_hoon_comment_to_universal();
 end if;
end $$;
