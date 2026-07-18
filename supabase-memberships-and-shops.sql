-- Hot Flash memberships, physical decal orders, and shop accounts

alter table public.profiles
  add column if not exists account_tier text not null default 'free'
    check (account_tier in ('free','verified','plus','shop','brand','admin')),
  add column if not exists subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive','trialing','active','past_due','canceled','expired')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists paypal_subscription_id text;

create table if not exists public.decal_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  order_type text not null default 'paid' check (order_type in ('paid','subscription_included','replacement','promotional')),
  amount_cents integer not null default 599 check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','approved','printing','shipped','delivered','canceled','refunded')),
  payment_provider text,
  payment_reference text,
  shipping_address_snapshot jsonb,
  tracking_number text,
  ordered_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text
);

alter table public.decal_orders enable row level security;

drop policy if exists "Members can view own decal orders" on public.decal_orders;
create policy "Members can view own decal orders"
  on public.decal_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Members can create own decal orders" on public.decal_orders;
create policy "Members can create own decal orders"
  on public.decal_orders for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can cancel unpaid decal orders" on public.decal_orders;
create policy "Members can cancel unpaid decal orders"
  on public.decal_orders for update
  using (auth.uid() = user_id and status = 'pending_payment')
  with check (auth.uid() = user_id);

create table if not exists public.shop_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  email text,
  website_url text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_region text,
  postal_code text,
  country text not null default 'United States',
  latitude numeric,
  longitude numeric,
  logo_url text,
  cover_url text,
  services text[],
  supports_e_tuning boolean not null default false,
  accepts_questions boolean not null default true,
  verified boolean not null default false,
  status text not null default 'draft' check (status in ('draft','pending_review','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_profiles enable row level security;

drop policy if exists "Active shops are public" on public.shop_profiles;
create policy "Active shops are public"
  on public.shop_profiles for select
  using (status = 'active' or auth.uid() = owner_id);

drop policy if exists "Owners manage shop profiles" on public.shop_profiles;
create policy "Owners manage shop profiles"
  on public.shop_profiles for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists decal_orders_user_idx on public.decal_orders(user_id, ordered_at desc);
create index if not exists decal_orders_vehicle_idx on public.decal_orders(vehicle_id, ordered_at desc);
create index if not exists shop_profiles_location_idx on public.shop_profiles(state_region, city);
