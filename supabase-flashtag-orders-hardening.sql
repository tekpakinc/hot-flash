alter table public.flashtag_orders
  drop constraint if exists flashtag_orders_badge_type_check;

alter table public.flashtag_orders
  add constraint flashtag_orders_badge_type_check
  check (badge_type in ('standard','founder'));

alter table public.flashtag_orders
  drop constraint if exists flashtag_orders_badge_size_check;

alter table public.flashtag_orders
  add constraint flashtag_orders_badge_size_check
  check (badge_size in ('4-inch','6-inch','custom'));

alter table public.flashtag_orders
  drop constraint if exists flashtag_orders_custom_size_notes_check;

alter table public.flashtag_orders
  add constraint flashtag_orders_custom_size_notes_check
  check (badge_size <> 'custom' or nullif(trim(notes),'') is not null);

drop policy if exists "Owners can create FlashTag orders" on public.flashtag_orders;
create policy "Owners can create FlashTag orders"
on public.flashtag_orders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_id
      and vehicles.owner_id = auth.uid()
      and (
        badge_type = 'standard'
        or (
          badge_type = 'founder'
          and vehicles.hotflash_id ~ '^HF-[0-9]{6}$'
          and substring(vehicles.hotflash_id from 4 for 6)::integer between 1 and 100
        )
      )
  )
);

create or replace function public.set_flashtag_order_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_flashtag_order_updated_at on public.flashtag_orders;
create trigger set_flashtag_order_updated_at
before update on public.flashtag_orders
for each row execute function public.set_flashtag_order_updated_at();
