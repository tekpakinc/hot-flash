-- FlashTag production artifact support
-- Run once in the Supabase SQL editor.

alter table public.flashtag_orders
  add column if not exists vehicle_snapshot jsonb,
  add column if not exists artifact_svg_path text,
  add column if not exists artifact_png_path text,
  add column if not exists artifact_generated_at timestamptz,
  add column if not exists artifact_error text;

comment on column public.flashtag_orders.vehicle_snapshot is
  'Immutable vehicle and badge details captured when the order was submitted.';
comment on column public.flashtag_orders.artifact_svg_path is
  'Supabase Storage path to the print-ready vector FlashTag.';
comment on column public.flashtag_orders.artifact_png_path is
  'Supabase Storage path to the high-resolution PNG FlashTag preview.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flashtag-artifacts',
  'flashtag-artifacts',
  true,
  10485760,
  array['image/svg+xml', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored under: <authenticated-user-id>/<order-id>/...
drop policy if exists "FlashTag owners upload artifacts" on storage.objects;
create policy "FlashTag owners upload artifacts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'flashtag-artifacts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "FlashTag owners update artifacts" on storage.objects;
create policy "FlashTag owners update artifacts"
on storage.objects for update
to authenticated
using (
  bucket_id = 'flashtag-artifacts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'flashtag-artifacts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "FlashTag owners remove artifacts" on storage.objects;
create policy "FlashTag owners remove artifacts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'flashtag-artifacts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The bucket is public so fulfillment staff can open the saved URLs from the
-- flashtag_orders table without generating temporary signed links.
