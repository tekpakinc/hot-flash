-- Hot Flash feedback center upgrades
-- Run after supabase-feedback-center.sql. Safe to rerun.

alter table public.feedback_reports
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

create index if not exists feedback_reports_vehicle_idx
  on public.feedback_reports(vehicle_id, created_at desc);

create table if not exists public.feedback_activity (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback_reports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_activity_report_idx
  on public.feedback_activity(feedback_id, created_at asc);

alter table public.feedback_activity enable row level security;

-- Members can see activity only for their own reports.
drop policy if exists "Members view own feedback activity" on public.feedback_activity;
create policy "Members view own feedback activity"
on public.feedback_activity for select
to authenticated
using (
  exists (
    select 1 from public.feedback_reports f
    where f.id = feedback_id and f.user_id = auth.uid()
  )
);

-- Record creation events for existing reports once.
insert into public.feedback_activity (feedback_id, actor_id, action, details, created_at)
select f.id, f.user_id, 'created', 'Report submitted', f.created_at
from public.feedback_reports f
where not exists (
  select 1 from public.feedback_activity a
  where a.feedback_id=f.id and a.action='created'
);

drop function if exists public.admin_list_feedback(text);
create function public.admin_list_feedback(p_status text default null)
returns table (
  id uuid,user_id uuid,vehicle_id uuid,tester_name text,contact_email text,follow_up_ok boolean,
  feedback_type text,area text,severity text,title text,details text,page_url text,
  device_info text,screenshot_path text,status text,admin_notes text,fixed_in_version text,
  created_at timestamptz,updated_at timestamptz,username text,display_name text,
  avatar_url text,hotflash_id text,vehicle_nickname text,vehicle_year integer,vehicle_make text,vehicle_model text
)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  return query
  select f.id,f.user_id,f.vehicle_id,f.tester_name,f.contact_email,f.follow_up_ok,f.feedback_type,f.area,
         f.severity,f.title,f.details,f.page_url,f.device_info,f.screenshot_path,f.status,
         f.admin_notes,f.fixed_in_version,f.created_at,f.updated_at,p.username,p.display_name,
         coalesce(to_jsonb(p)->>'avatar_url',to_jsonb(p)->>'profile_image_url',to_jsonb(p)->>'photo_url') as avatar_url,
         v.hotflash_id,v.nickname,v.year,v.make,v.model
  from public.feedback_reports f
  left join public.profiles p on p.id=f.user_id
  left join public.vehicles v on v.id=f.vehicle_id
  where p_status is null or f.status=p_status
  order by case f.status when 'new' then 0 when 'investigating' then 1 when 'need_more_info' then 2 when 'fixed' then 3 else 4 end,
           f.created_at desc;
end;
$$;

drop function if exists public.admin_update_feedback(uuid,text,text,text);
create function public.admin_update_feedback(
  p_feedback_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_fixed_in_version text default null
)
returns public.feedback_reports
language plpgsql security definer set search_path=public
as $$
declare
  v_report public.feedback_reports;
  v_old_status text;
  v_old_notes text;
  v_old_version text;
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('new','investigating','need_more_info','fixed','closed') then raise exception 'Invalid feedback status'; end if;

  select status,admin_notes,fixed_in_version into v_old_status,v_old_notes,v_old_version
  from public.feedback_reports where id=p_feedback_id;

  update public.feedback_reports set
    status=p_status,
    admin_notes=nullif(trim(p_admin_notes),''),
    fixed_in_version=nullif(trim(p_fixed_in_version),''),
    updated_at=now(),updated_by=auth.uid()
  where id=p_feedback_id returning * into v_report;

  if v_report.id is null then raise exception 'Feedback report not found'; end if;

  if v_old_status is distinct from p_status then
    insert into public.feedback_activity(feedback_id,actor_id,action,details)
    values(p_feedback_id,auth.uid(),'status_changed',replace(v_old_status,'_',' ')||' → '||replace(p_status,'_',' '));
  end if;
  if v_old_notes is distinct from nullif(trim(p_admin_notes),'') then
    insert into public.feedback_activity(feedback_id,actor_id,action,details)
    values(p_feedback_id,auth.uid(),'notes_updated','Admin notes updated');
  end if;
  if v_old_version is distinct from nullif(trim(p_fixed_in_version),'') and nullif(trim(p_fixed_in_version),'') is not null then
    insert into public.feedback_activity(feedback_id,actor_id,action,details)
    values(p_feedback_id,auth.uid(),'version_set','Fixed in '||trim(p_fixed_in_version));
  end if;

  return v_report;
end;
$$;

create or replace function public.admin_feedback_activity(p_feedback_id uuid)
returns table(id uuid,actor_id uuid,action text,details text,created_at timestamptz,actor_name text)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_hotflash_admin() then raise exception 'Admin access required'; end if;
  return query
  select a.id,a.actor_id,a.action,a.details,a.created_at,
         coalesce(p.display_name,p.username,'Hot Flash staff')
  from public.feedback_activity a
  left join public.profiles p on p.id=a.actor_id
  where a.feedback_id=p_feedback_id
  order by a.created_at asc;
end;
$$;

grant execute on function public.admin_list_feedback(text) to authenticated;
grant execute on function public.admin_update_feedback(uuid,text,text,text) to authenticated;
grant execute on function public.admin_feedback_activity(uuid) to authenticated;