-- Hot Flash editable comments
-- Allows a comment author to edit their own Hoon Pad comment and records edit time.

alter table public.hoon_comments
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_hoon_comment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hoon_comments_touch_updated_at on public.hoon_comments;
create trigger hoon_comments_touch_updated_at
before update of body on public.hoon_comments
for each row execute function public.touch_hoon_comment_updated_at();

alter table public.hoon_comments enable row level security;

drop policy if exists "Authors update own Hoon comments" on public.hoon_comments;
create policy "Authors update own Hoon comments"
on public.hoon_comments
for update
to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and char_length(trim(body)) between 1 and 500
);

create or replace function public.update_own_hoon_comment(
  p_comment_id uuid,
  p_body text
)
returns public.hoon_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.hoon_comments;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'Comment cannot be empty';
  end if;
  if char_length(trim(p_body)) > 500 then
    raise exception 'Comment must be 500 characters or fewer';
  end if;

  update public.hoon_comments
  set body = trim(p_body)
  where id = p_comment_id
    and author_id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'Only the comment author can edit this comment';
  end if;
  return result;
end;
$$;

grant execute on function public.update_own_hoon_comment(uuid,text) to authenticated;
