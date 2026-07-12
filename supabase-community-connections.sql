-- HOT FLASH COMMUNITY CONNECTIONS MVP
alter table profiles add column if not exists location text;
alter table profiles add column if not exists location_visibility text not null default 'public';

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table if not exists user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null check(char_length(title) between 2 and 140),
  description text,
  event_type text not null default 'meet',
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  location text not null,
  website_url text,
  image_url text,
  created_at timestamptz not null default now()
);
create table if not exists event_attendees (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  status text not null default 'interested' check(status in ('interested','going')),
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create table if not exists event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table user_blocks enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table event_comments enable row level security;

create policy "Members view conversations" on conversations for select using (exists(select 1 from conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy "Authenticated create conversations" on conversations for insert with check (auth.uid() is not null);
create policy "Members view memberships" on conversation_members for select using (exists(select 1 from conversation_members mine where mine.conversation_id=conversation_id and mine.user_id=auth.uid()));
create policy "Users join conversations" on conversation_members for insert with check (auth.uid()=user_id or auth.uid() is not null);
create policy "Members view messages" on messages for select using (exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "Members send messages" on messages for insert with check (auth.uid()=sender_id and exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "Recipients mark messages read" on messages for update using (exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid())) with check (exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "Users manage blocks" on user_blocks for all using (auth.uid()=blocker_id) with check (auth.uid()=blocker_id);
create policy "Events public read" on events for select using (true);
create policy "Authenticated create events" on events for insert with check (auth.uid()=creator_id);
create policy "Creators update events" on events for update using (auth.uid()=creator_id) with check (auth.uid()=creator_id);
create policy "Creators delete events" on events for delete using (auth.uid()=creator_id);
create policy "Attendance public read" on event_attendees for select using (true);
create policy "Users manage attendance" on event_attendees for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Event comments public read" on event_comments for select using (true);
create policy "Users create event comments" on event_comments for insert with check (auth.uid()=author_id);
create policy "Authors delete event comments" on event_comments for delete using (auth.uid()=author_id);

create index if not exists messages_conversation_idx on messages(conversation_id,created_at);
create index if not exists events_starts_idx on events(starts_at);
create index if not exists events_location_idx on events(location);
create index if not exists attendance_event_idx on event_attendees(event_id,status);
create index if not exists event_comments_idx on event_comments(event_id,created_at);