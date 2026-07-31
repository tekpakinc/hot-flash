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

-- Owners can save only generated artifact metadata for their own order without
-- receiving broad UPDATE permission over fulfillment fields such as status.
create or replace function public.save_flashtag_order_artifacts(
  p_order_id uuid,
  p_vehicle_snapshot jsonb,
  p_svg_path text default null,
  p_png_path text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flashtag_orders
  set vehicle_snapshot = coalesce(p_vehicle_snapshot, vehicle_snapshot),
      artifact_svg_path = p_svg_path,
      artifact_png_path = p_png_path,
      artifact_generated_at = case
        when p_svg_path is not null or p_png_path is not null then now()
        else artifact_generated_at
      end,
      artifact_error = nullif(trim(coalesce(p_error, '')), '')
  where id = p_order_id
    and user_id = auth.uid();

  if not found then
    raise exception 'FlashTag order not found or access denied';
  end if;
end;
$$;

revoke all on function public.save_flashtag_order_artifacts(uuid,jsonb,text,text,text) from public;
grant execute on function public.save_flashtag_order_artifacts(uuid,jsonb,text,text,text) to authenticated;

-- The bucket is public so fulfillment staff can open the saved URLs from the
-- flashtag_orders table without generating temporary signed links.
