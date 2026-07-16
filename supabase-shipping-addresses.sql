create table if not exists public.shipping_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_region text,
  postal_code text,
  country text not null default 'United States',
  phone text,
  updated_at timestamptz not null default now()
);

alter table public.shipping_addresses enable row level security;

drop policy if exists "Users can read their own shipping address" on public.shipping_addresses;
create policy "Users can read their own shipping address"
on public.shipping_addresses for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own shipping address" on public.shipping_addresses;
create policy "Users can insert their own shipping address"
on public.shipping_addresses for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own shipping address" on public.shipping_addresses;
create policy "Users can update their own shipping address"
on public.shipping_addresses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own shipping address" on public.shipping_addresses;
create policy "Users can delete their own shipping address"
on public.shipping_addresses for delete
using (auth.uid() = user_id);

comment on table public.shipping_addresses is 'Private mailing details used for Hot Flash decals, rewards, and hardware shipments. Never expose through public profile queries.';
