-- Fix: "infinite recursion detected in policy for relation conversation_members"
-- Uses SECURITY DEFINER helpers so RLS policies never query conversation_members recursively.

create or replace function public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

create or replace function public.start_direct_conversation(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
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

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Member not found';
  end if;

  -- Reuse an existing two-person conversation when possible.
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

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- Remove every existing policy on the affected tables, including policies whose
-- original names may differ between environments.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversation_members', 'conversations', 'messages')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

alter table public.conversation_members enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Members can view conversation membership"
on public.conversation_members
for select
to authenticated
using (public.is_conversation_member(conversation_id));

-- Membership creation is intentionally handled only by start_direct_conversation().
-- Existing members may remove only themselves from a conversation.
create policy "Members can leave conversations"
on public.conversation_members
for delete
to authenticated
using (user_id = auth.uid());

create policy "Members can view conversations"
on public.conversations
for select
to authenticated
using (public.is_conversation_member(id));

create policy "Members can view messages"
on public.messages
for select
to authenticated
using (public.is_conversation_member(conversation_id));

create policy "Members can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

create policy "Members can mark received messages read"
on public.messages
for update
to authenticated
using (
  public.is_conversation_member(conversation_id)
  and sender_id <> auth.uid()
)
with check (public.is_conversation_member(conversation_id));

-- Helpful uniqueness protection for membership rows.
create unique index if not exists conversation_members_conversation_user_key
on public.conversation_members (conversation_id, user_id);
