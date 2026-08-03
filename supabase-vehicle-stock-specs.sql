-- Hot Flash vehicle stock-specification snapshot fields
-- Run once in Supabase SQL Editor.

alter table public.vehicles
  add column if not exists vin text,
  add column if not exists engine_displacement text,
  add column if not exists engine_cylinders text,
  add column if not exists aspiration text,
  add column if not exists drivetrain text,
  add column if not exists transmission text,
  add column if not exists fuel_type text,
  add column if not exists body_style text,
  add column if not exists factory_trim text,
  add column if not exists stock_specs_source text,
  add column if not exists stock_specs_decoded_at timestamptz;

alter table public.vehicles drop constraint if exists vehicles_vin_format_check;
alter table public.vehicles add constraint vehicles_vin_format_check
  check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9*]{11,17}$');

create unique index if not exists vehicles_owner_vin_unique
  on public.vehicles(owner_id,vin)
  where vin is not null;

comment on column public.vehicles.vin is 'Optional VIN used for owner-requested stock specification decoding. Public display should remain disabled unless explicitly enabled later.';
comment on column public.vehicles.stock_specs_source is 'Source label for suggested factory specifications, such as NHTSA vPIC.';
comment on column public.vehicles.stock_specs_decoded_at is 'Time the stock specification snapshot was decoded. Suggested values remain owner-editable.';