-- Fix conversation creation being blocked by RLS on public.conversations.
-- The client only calls this RPC; it never inserts conversation rows directly.

create or replace function public.start_direct_conversation(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_me uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if p_target_user_id is null or p_target_user_id = v_me then
    raise exception 'Choose another member';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_target_user_id
  ) then
    raise exception 'Member not found';
  end if;

  -- Serialize this user pair so two simultaneous requests cannot create duplicates.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(v_me::text, p_target_user_id::text) || ':' ||
      greatest(v_me::text, p_target_user_id::text),
      0
    )
  );

  select cm1.conversation_id
    into v_conversation_id
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm2.conversation_id = cm1.conversation_id
   and cm2.user_id = p_target_user_id
  where cm1.user_id = v_me
    and (
      select count(*)
      from public.conversation_members members
      where members.conversation_id = cm1.conversation_id
    ) = 2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations default values
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (v_conversation_id, v_me),
    (v_conversation_id, p_target_user_id);

  return v_conversation_id;
end;
$$;

-- Supabase migrations run as the database owner. Explicit ownership plus
-- row_security=off ensures the SECURITY DEFINER function can perform its
-- tightly-scoped inserts even when RLS is enabled or forced on the tables.
alter function public.start_direct_conversation(uuid) owner to postgres;
revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- Direct client inserts remain intentionally unavailable.
revoke insert on table public.conversations from anon, authenticated;
revoke insert on table public.conversation_members from anon, authenticated;
