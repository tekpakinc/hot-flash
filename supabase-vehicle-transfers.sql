-- Permanent vehicle identity and ownership-transfer support
-- Run once in the Supabase SQL editor.

create table if not exists public.vehicle_transfers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  transfer_mode text not null default 'preserve_private'
    check (transfer_mode in ('full_history','preserve_private','new_chapter')),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','expired')),
  message text,
  requested_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.vehicle_transfers
  drop constraint if exists vehicle_transfers_vehicle_id_status_key;
create unique index if not exists vehicle_transfers_one_pending_per_vehicle_idx
  on public.vehicle_transfers (vehicle_id) where status = 'pending';
create index if not exists vehicle_transfers_recipient_idx
  on public.vehicle_transfers (to_user_id, status, requested_at desc);
create index if not exists vehicle_transfers_sender_idx
  on public.vehicle_transfers (from_user_id, status, requested_at desc);

create table if not exists public.vehicle_ownership_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  released_at timestamptz,
  transfer_id uuid references public.vehicle_transfers(id) on delete set null,
  transfer_mode text check (transfer_mode in ('full_history','preserve_private','new_chapter'))
);

create index if not exists vehicle_ownership_history_vehicle_idx
  on public.vehicle_ownership_history (vehicle_id, acquired_at);

alter table public.vehicle_transfers enable row level security;
alter table public.vehicle_ownership_history enable row level security;

drop policy if exists "Transfer parties can view requests" on public.vehicle_transfers;
create policy "Transfer parties can view requests"
on public.vehicle_transfers for select
to authenticated
using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Public can view ownership history" on public.vehicle_ownership_history;
create policy "Public can view ownership history"
on public.vehicle_ownership_history for select
to anon, authenticated
using (true);

create or replace function public.request_vehicle_transfer(
  p_vehicle_id uuid,
  p_recipient_username text,
  p_transfer_mode text default 'preserve_private',
  p_message text default null
)
returns public.vehicle_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
  v_recipient uuid;
  v_transfer public.vehicle_transfers;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.id is null then raise exception 'Vehicle not found'; end if;
  if v_vehicle.owner_id <> auth.uid() then raise exception 'Only the current owner can transfer this vehicle'; end if;

  select id into v_recipient
  from public.profiles
  where lower(username) = lower(trim(p_recipient_username))
  limit 1;

  if v_recipient is null then raise exception 'No Hot Flash member was found with that username'; end if;
  if v_recipient = auth.uid() then raise exception 'You already own this vehicle'; end if;
  if p_transfer_mode not in ('full_history','preserve_private','new_chapter') then raise exception 'Invalid transfer mode'; end if;

  update public.vehicle_transfers
  set status = 'cancelled', responded_at = now()
  where vehicle_id = p_vehicle_id and status = 'pending';

  insert into public.vehicle_transfers(vehicle_id,from_user_id,to_user_id,transfer_mode,message)
  values (p_vehicle_id,auth.uid(),v_recipient,p_transfer_mode,nullif(trim(p_message),''))
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function public.respond_to_vehicle_transfer(
  p_transfer_id uuid,
  p_accept boolean
)
returns public.vehicle_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.vehicle_transfers;
  v_vehicle public.vehicles;
begin
  select * into v_transfer
  from public.vehicle_transfers
  where id = p_transfer_id
  for update;

  if v_transfer.id is null then raise exception 'Transfer request not found'; end if;
  if v_transfer.to_user_id <> auth.uid() then raise exception 'Only the recipient can respond to this transfer'; end if;
  if v_transfer.status <> 'pending' then raise exception 'This transfer request is no longer pending'; end if;

  select * into v_vehicle from public.vehicles where id = v_transfer.vehicle_id for update;
  if v_vehicle.owner_id <> v_transfer.from_user_id then
    update public.vehicle_transfers set status='expired',responded_at=now() where id=p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  if not p_accept then
    update public.vehicle_transfers set status='declined',responded_at=now() where id=p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  update public.vehicle_ownership_history
  set released_at = now(), transfer_id = p_transfer_id, transfer_mode = v_transfer.transfer_mode
  where vehicle_id = v_transfer.vehicle_id and owner_id = v_transfer.from_user_id and released_at is null;

  if not found then
    insert into public.vehicle_ownership_history(vehicle_id,owner_id,acquired_at,released_at,transfer_id,transfer_mode)
    values (v_transfer.vehicle_id,v_transfer.from_user_id,coalesce(v_vehicle.created_at,now()),now(),p_transfer_id,v_transfer.transfer_mode);
  end if;

  update public.vehicles
  set owner_id = v_transfer.to_user_id
  where id = v_transfer.vehicle_id;

  insert into public.vehicle_ownership_history(vehicle_id,owner_id,acquired_at,transfer_id,transfer_mode)
  values (v_transfer.vehicle_id,v_transfer.to_user_id,now(),p_transfer_id,v_transfer.transfer_mode);

  update public.vehicle_transfers
  set status='accepted',responded_at=now()
  where id=p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function public.cancel_vehicle_transfer(p_transfer_id uuid)
returns public.vehicle_transfers
language plpgsql
security definer
set search_path = public
as $$
declare v_transfer public.vehicle_transfers;
begin
  update public.vehicle_transfers
  set status='cancelled',responded_at=now()
  where id=p_transfer_id and from_user_id=auth.uid() and status='pending'
  returning * into v_transfer;
  if v_transfer.id is null then raise exception 'Pending transfer request not found'; end if;
  return v_transfer;
end;
$$;

grant execute on function public.request_vehicle_transfer(uuid,text,text,text) to authenticated;
grant execute on function public.respond_to_vehicle_transfer(uuid,boolean) to authenticated;
grant execute on function public.cancel_vehicle_transfer(uuid) to authenticated;

comment on table public.vehicle_transfers is 'Two-party ownership transfers. The vehicle and permanent Hot Flash ID stay unchanged.';
comment on column public.vehicle_transfers.transfer_mode is 'Controls how earlier ownership chapters should be presented; it never changes the permanent FlashTag URL.';