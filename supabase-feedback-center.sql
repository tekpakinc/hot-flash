-- Hot Flash in-app feedback center
-- Run once in Supabase SQL Editor after supabase-admin-console.sql.

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tester_name text,
  contact_email text,
  follow_up_ok boolean not null default false,
  feedback_type text not null,
  area text not null,
  severity text not null default 'Moderate',
  title text not null,
  details text not null,
  page_url text,
  device_info text,
  screenshot_path text,
  status text not null default 'new' check (status in ('new','investigating','need_more_info','fixed','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  admin_notes text,
  fixed_in_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists feedback_reports_status_idx on public.feedback_reports(status,created_at desc);
create index if not exists feedback_reports_user_idx on public.feedback_reports(user_id,created_at desc);

alter table public.feedback_reports enable row level security;

drop policy if exists "Members can submit feedback" on public.feedback_reports;
create policy "Members can submit feedback"
on public.feedback_reports for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Members can view own feedback" on public.feedback_reports;
create policy "Members can view own feedback"
on public.feedback_reports for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('feedback-screenshots','feedback-screenshots',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Members upload own feedback screenshots" on storage.objects;
create policy "Members upload own feedback screenshots"
on storage.objects for insert
to authenticated
with check (bucket_id='feedback-screenshots' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Members view own feedback screenshots" on storage.objects;
create policy "Members view own feedback screenshots"
on storage.objects for select
to authenticated
using (bucket_id='feedback-screenshots' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.admin_list_feedback(p_status text default null)
returns table (
  id uuid,user_id uuid,tester_name text,contact_email text,follow_up_ok boolean,
  feedback_type text,area text,severity text,title text,details text,page_url text,
  device_info text,screenshot_path text,status text,admin_notes text,fixed_in_version text,
  created_at timestamptz,updated_at timestamptz,username text,display_name text
)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  return query
  select f.id,f.user_id,f.tester_name,f.contact_email,f.follow_up_ok,f.feedback_type,f.area,
         f.severity,f.title,f.details,f.page_url,f.device_info,f.screenshot_path,f.status,
         f.admin_notes,f.fixed_in_version,f.created_at,f.updated_at,p.username,p.display_name
  from public.feedback_reports f
  left join public.profiles p on p.id=f.user_id
  where p_status is null or f.status=p_status
  order by case f.status when 'new' then 0 when 'investigating' then 1 when 'need_more_info' then 2 when 'fixed' then 3 else 4 end,
           f.created_at desc;
end;
$$;

create or replace function public.admin_update_feedback(
  p_feedback_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_fixed_in_version text default null
)
returns public.feedback_reports
language plpgsql security definer set search_path=public
as $$
declare v_report public.feedback_reports;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('new','investigating','need_more_info','fixed','closed') then raise exception 'Invalid feedback status'; end if;
  update public.feedback_reports set
    status=p_status,
    admin_notes=nullif(trim(p_admin_notes),''),
    fixed_in_version=nullif(trim(p_fixed_in_version),''),
    updated_at=now(),updated_by=auth.uid()
  where id=p_feedback_id returning * into v_report;
  if v_report.id is null then raise exception 'Feedback report not found'; end if;
  return v_report;
end;
$$;

grant execute on function public.admin_list_feedback(text) to authenticated;
grant execute on function public.admin_update_feedback(uuid,text,text,text) to authenticated;
