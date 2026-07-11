-- HOT FLASH: expanded vehicle build details
-- Safe to run more than once.

alter table public.vehicles
  add column if not exists build_summary text,
  add column if not exists powertrain text,
  add column if not exists suspension_brakes text,
  add column if not exists wheels_tires text,
  add column if not exists exterior text,
  add column if not exists interior text,
  add column if not exists electronics_audio text;

comment on column public.vehicles.build_summary is 'Plain-language overview of what has been done to the vehicle.';
comment on column public.vehicles.powertrain is 'Engine, transmission, induction, exhaust, tune, and related powertrain details.';
comment on column public.vehicles.suspension_brakes is 'Suspension, steering, and braking modifications.';
comment on column public.vehicles.wheels_tires is 'Wheel, tire, and fitment details.';
comment on column public.vehicles.exterior is 'Paint, body, aero, lighting, and exterior modifications.';
comment on column public.vehicles.interior is 'Seats, upholstery, cage, gauges, and interior modifications.';
comment on column public.vehicles.electronics_audio is 'ECU, gauges, lighting, audio, and other electronics.';
