create extension if not exists pgcrypto;

create table if not exists public.beta_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  is_admin boolean not null default false,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug','ui','idea','feature')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null,
  reproduction_steps text,
  page_url text,
  user_agent text,
  screen_size text,
  platform text,
  screenshot_path text,
  status text not null default 'new' check (status in ('new','reviewing','planned','in_progress','fixed','declined')),
  admin_notes text,
  admin_response text,
  github_issue_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_feedback_user_created_idx on public.beta_feedback(user_id, created_at desc);
create index if not exists beta_feedback_status_created_idx on public.beta_feedback(status, created_at desc);

alter table public.beta_testers enable row level security;
alter table public.beta_feedback enable row level security;

drop policy if exists "testers can view own access" on public.beta_testers;
create policy "testers can view own access" on public.beta_testers for select to authenticated using (user_id = auth.uid());

drop policy if exists "testers can submit feedback" on public.beta_feedback;
create policy "testers can submit feedback" on public.beta_feedback for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true
  )
);

drop policy if exists "testers can view own feedback" on public.beta_feedback;
create policy "testers can view own feedback" on public.beta_feedback for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true and bt.is_admin = true
  )
);

drop policy if exists "admins can update feedback" on public.beta_feedback;
create policy "admins can update feedback" on public.beta_feedback for update to authenticated using (
  exists (select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true and bt.is_admin = true)
) with check (
  exists (select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true and bt.is_admin = true)
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('beta-feedback','beta-feedback',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=8388608;

drop policy if exists "testers upload feedback screenshots" on storage.objects;
create policy "testers upload feedback screenshots" on storage.objects for insert to authenticated with check (
  bucket_id = 'beta-feedback'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true)
);

drop policy if exists "testers view own feedback screenshots" on storage.objects;
create policy "testers view own feedback screenshots" on storage.objects for select to authenticated using (
  bucket_id = 'beta-feedback' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.beta_testers bt where bt.user_id = auth.uid() and bt.is_active = true and bt.is_admin = true)
  )
);

-- Add approved users after running this migration:
-- insert into public.beta_testers (user_id,is_admin) values ('USER_UUID',false);
-- Add the owner/super-admin with is_admin=true.
