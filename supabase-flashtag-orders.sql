create table if not exists public.flashtag_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  hotflash_id text,
  vehicle_name text,
  customer_name text not null,
  email text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'United States',
  badge_type text not null default 'standard',
  badge_size text not null default '4-inch',
  quantity integer not null default 1 check (quantity between 1 and 20),
  notes text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','awaiting_payment','paid','in_production','shipped','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flashtag_orders enable row level security;

drop policy if exists "Owners can create FlashTag orders" on public.flashtag_orders;
create policy "Owners can create FlashTag orders"
on public.flashtag_orders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.vehicles
    where vehicles.id = vehicle_id
      and vehicles.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can view their FlashTag orders" on public.flashtag_orders;
create policy "Owners can view their FlashTag orders"
on public.flashtag_orders
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists flashtag_orders_created_at_idx on public.flashtag_orders(created_at desc);
create index if not exists flashtag_orders_vehicle_id_idx on public.flashtag_orders(vehicle_id);

comment on table public.flashtag_orders is 'Physical FlashTag badge order requests submitted by vehicle owners.';