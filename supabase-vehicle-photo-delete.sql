-- Secure vehicle photo deletion for Hot Flash
-- Returns the storage path only after confirming current ownership.

create or replace function public.delete_vehicle_image_secure(p_image_id uuid)
returns table(storage_path text, image_url text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_path text;
  v_url text;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select vi.storage_path, vi.image_url
    into v_path, v_url
  from public.vehicle_images vi
  join public.vehicles v on v.id=vi.vehicle_id
  where vi.id=p_image_id
    and vi.owner_id=v_user
    and v.owner_id=v_user
  for update;

  if not found then
    raise exception 'Only the current vehicle owner can delete this photo.';
  end if;

  delete from public.vehicle_images where id=p_image_id;
  return query select v_path, v_url;
end;
$$;

grant execute on function public.delete_vehicle_image_secure(uuid) to authenticated;

comment on function public.delete_vehicle_image_secure(uuid) is
'Verifies current vehicle ownership, deletes one vehicle image row, and returns its storage path for client-side object cleanup.';
