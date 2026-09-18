-- Shareable vehicle ownership claim links
-- Deploy through Supabase migrations before using the claim-link UI.

alter table public.vehicle_transfers
  alter column to_user_id drop not null;

alter table public.vehicle_transfers
  add column if not exists claim_token uuid,
  add column if not exists expires_at timestamptz;

create unique index if not exists vehicle_transfers_claim_token_idx
  on public.vehicle_transfers(claim_token) where claim_token is not null;

create or replace function public.create_vehicle_transfer_link(
  p_vehicle_id uuid,
  p_transfer_mode text default 'preserve_private',
  p_message text default null
)
returns table(transfer_id uuid, claim_token uuid, expires_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare v_vehicle public.vehicles; v_transfer public.vehicle_transfers;
begin
  select * into v_vehicle from public.vehicles where id=p_vehicle_id for update;
  if v_vehicle.id is null then raise exception 'Vehicle not found'; end if;
  if v_vehicle.owner_id<>auth.uid() then raise exception 'Only the current owner can transfer this vehicle'; end if;
  if p_transfer_mode not in ('full_history','preserve_private','new_chapter') then raise exception 'Invalid transfer mode'; end if;

  update public.vehicle_transfers set status='cancelled',responded_at=now()
    where vehicle_id=p_vehicle_id and status='pending';

  insert into public.vehicle_transfers(vehicle_id,from_user_id,to_user_id,transfer_mode,status,message,claim_token,expires_at)
  values(p_vehicle_id,auth.uid(),null,p_transfer_mode,'pending',nullif(trim(p_message),''),gen_random_uuid(),now()+interval '14 days')
  returning * into v_transfer;

  return query select v_transfer.id,v_transfer.claim_token,v_transfer.expires_at;
end $$;

create or replace function public.get_vehicle_transfer_claim(p_claim_token uuid)
returns table(transfer_id uuid, vehicle_id uuid, hotflash_id text, nickname text, year integer, make text, model text, transfer_mode text, message text, expires_at timestamptz, status text)
language sql security definer set search_path=public
as $$
  select t.id,v.id,v.hotflash_id,v.nickname,v.year,v.make,v.model,t.transfer_mode,t.message,t.expires_at,t.status
  from public.vehicle_transfers t join public.vehicles v on v.id=t.vehicle_id
  where t.claim_token=p_claim_token
$$;

create or replace function public.claim_vehicle_transfer(p_claim_token uuid)
returns public.vehicle_transfers
language plpgsql security definer set search_path=public
as $$
declare v_transfer public.vehicle_transfers; v_vehicle public.vehicles;
begin
  if auth.uid() is null then raise exception 'Sign in or create an account to claim this vehicle'; end if;
  select * into v_transfer from public.vehicle_transfers where claim_token=p_claim_token for update;
  if v_transfer.id is null then raise exception 'Claim link not found'; end if;
  if v_transfer.status<>'pending' then raise exception 'This claim link is no longer active'; end if;
  if v_transfer.expires_at is not null and v_transfer.expires_at<now() then
    update public.vehicle_transfers set status='expired',responded_at=now() where id=v_transfer.id returning * into v_transfer;
    raise exception 'This claim link has expired';
  end if;
  if v_transfer.from_user_id=auth.uid() then raise exception 'You already own this vehicle'; end if;

  select * into v_vehicle from public.vehicles where id=v_transfer.vehicle_id for update;
  if v_vehicle.owner_id<>v_transfer.from_user_id then
    update public.vehicle_transfers set status='expired',responded_at=now() where id=v_transfer.id returning * into v_transfer;
    raise exception 'This vehicle is no longer available to claim';
  end if;

  update public.vehicle_ownership_history set released_at=now(),transfer_id=v_transfer.id,transfer_mode=v_transfer.transfer_mode
    where vehicle_id=v_transfer.vehicle_id and owner_id=v_transfer.from_user_id and released_at is null;
  if not found then
    insert into public.vehicle_ownership_history(vehicle_id,owner_id,acquired_at,released_at,transfer_id,transfer_mode)
    values(v_transfer.vehicle_id,v_transfer.from_user_id,coalesce(v_vehicle.created_at,now()),now(),v_transfer.id,v_transfer.transfer_mode);
  end if;

  update public.vehicles set owner_id=auth.uid() where id=v_transfer.vehicle_id;
  insert into public.vehicle_ownership_history(vehicle_id,owner_id,acquired_at,transfer_id,transfer_mode)
    values(v_transfer.vehicle_id,auth.uid(),now(),v_transfer.id,v_transfer.transfer_mode);
  update public.vehicle_transfers set to_user_id=auth.uid(),status='accepted',responded_at=now()
    where id=v_transfer.id returning * into v_transfer;
  return v_transfer;
end $$;

grant execute on function public.create_vehicle_transfer_link(uuid,text,text) to authenticated;
grant execute on function public.get_vehicle_transfer_claim(uuid) to anon,authenticated;
grant execute on function public.claim_vehicle_transfer(uuid) to authenticated;
