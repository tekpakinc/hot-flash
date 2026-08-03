-- Complete Hoon Pad social features: comments, saved clips, and feed statistics.

create table if not exists public.hoon_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hoon_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hoon_comments_post_created_idx on public.hoon_comments(post_id, created_at);
create index if not exists hoon_comments_author_idx on public.hoon_comments(author_id);

create table if not exists public.hoon_saves (
  post_id uuid not null references public.hoon_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists hoon_saves_user_created_idx on public.hoon_saves(user_id, created_at desc);

alter table public.hoon_comments enable row level security;
alter table public.hoon_saves enable row level security;

drop policy if exists "Hoon comments are publicly readable" on public.hoon_comments;
create policy "Hoon comments are publicly readable" on public.hoon_comments for select using (true);

drop policy if exists "Members create own Hoon comments" on public.hoon_comments;
create policy "Members create own Hoon comments" on public.hoon_comments for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "Members delete own Hoon comments" on public.hoon_comments;
create policy "Members delete own Hoon comments" on public.hoon_comments for delete to authenticated
using (author_id = auth.uid() or public.is_hotflash_admin());

drop policy if exists "Members read own Hoon saves" on public.hoon_saves;
create policy "Members read own Hoon saves" on public.hoon_saves for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Members create own Hoon saves" on public.hoon_saves;
create policy "Members create own Hoon saves" on public.hoon_saves for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Members delete own Hoon saves" on public.hoon_saves;
create policy "Members delete own Hoon saves" on public.hoon_saves for delete to authenticated
using (user_id = auth.uid());

-- The view exposes aggregate counts only. Individual save records remain private under RLS.
create or replace view public.hoon_post_stats as
select
  p.*,
  coalesce(f.flame_count, 0)::bigint as flame_count,
  coalesce(c.comment_count, 0)::bigint as comment_count,
  coalesce(s.save_count, 0)::bigint as save_count,
  (
    coalesce(f.flame_count, 0) * 3 +
    coalesce(c.comment_count, 0) * 5 +
    coalesce(s.save_count, 0) * 2 +
    greatest(0, 72 - extract(epoch from (now() - p.created_at)) / 3600)
  )::numeric as trending_score
from public.hoon_posts p
left join (select post_id, count(*) flame_count from public.hoon_flames group by post_id) f on f.post_id = p.id
left join (select post_id, count(*) comment_count from public.hoon_comments group by post_id) c on c.post_id = p.id
left join (select post_id, count(*) save_count from public.hoon_saves group by post_id) s on s.post_id = p.id;

grant select on public.hoon_post_stats to anon, authenticated;
grant select, insert, delete on public.hoon_comments to authenticated;
grant select, insert, delete on public.hoon_saves to authenticated;
