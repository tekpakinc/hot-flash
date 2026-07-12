-- HOT FLASH SOCIAL PLATFORM V1
create extension if not exists pgcrypto;

alter table profiles add column if not exists location text;
alter table profiles add column if not exists website text;
alter table profiles add column if not exists profile_visibility text default 'public';

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profile_followers (
  profile_id uuid not null references profiles(id) on delete cascade,
  follower_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(profile_id,follower_id),
  check(profile_id <> follower_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type text not null,
  post_id uuid references posts(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  comment_id uuid references post_comments(id) on delete cascade,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
alter table profile_followers enable row level security;
alter table notifications enable row level security;

-- Idempotent policy reset
DO $$ BEGIN
  drop policy if exists "Posts public read" on posts;
  drop policy if exists "Users create posts" on posts;
  drop policy if exists "Authors update posts" on posts;
  drop policy if exists "Authors delete posts" on posts;
  drop policy if exists "Likes public read" on post_likes;
  drop policy if exists "Users like posts" on post_likes;
  drop policy if exists "Users unlike posts" on post_likes;
  drop policy if exists "Comments public read" on post_comments;
  drop policy if exists "Users create comments" on post_comments;
  drop policy if exists "Authors update comments" on post_comments;
  drop policy if exists "Authors delete comments" on post_comments;
  drop policy if exists "Profile follows public read" on profile_followers;
  drop policy if exists "Users follow profiles" on profile_followers;
  drop policy if exists "Users unfollow profiles" on profile_followers;
  drop policy if exists "Recipients read notifications" on notifications;
  drop policy if exists "Recipients update notifications" on notifications;
  drop policy if exists "Authenticated create notifications" on notifications;
END $$;

create policy "Posts public read" on posts for select using (true);
create policy "Users create posts" on posts for insert with check (auth.uid()=author_id);
create policy "Authors update posts" on posts for update using (auth.uid()=author_id) with check (auth.uid()=author_id);
create policy "Authors delete posts" on posts for delete using (auth.uid()=author_id);

create policy "Likes public read" on post_likes for select using (true);
create policy "Users like posts" on post_likes for insert with check (auth.uid()=user_id);
create policy "Users unlike posts" on post_likes for delete using (auth.uid()=user_id);

create policy "Comments public read" on post_comments for select using (true);
create policy "Users create comments" on post_comments for insert with check (auth.uid()=author_id);
create policy "Authors update comments" on post_comments for update using (auth.uid()=author_id) with check (auth.uid()=author_id);
create policy "Authors delete comments" on post_comments for delete using (auth.uid()=author_id);

create policy "Profile follows public read" on profile_followers for select using (true);
create policy "Users follow profiles" on profile_followers for insert with check (auth.uid()=follower_id);
create policy "Users unfollow profiles" on profile_followers for delete using (auth.uid()=follower_id);

create policy "Recipients read notifications" on notifications for select using (auth.uid()=recipient_id);
create policy "Recipients update notifications" on notifications for update using (auth.uid()=recipient_id) with check (auth.uid()=recipient_id);
create policy "Authenticated create notifications" on notifications for insert with check (auth.uid()=actor_id);

create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists posts_vehicle_idx on posts(vehicle_id,created_at desc);
create index if not exists comments_post_idx on post_comments(post_id,created_at);
create index if not exists notifications_recipient_idx on notifications(recipient_id,is_read,created_at desc);
