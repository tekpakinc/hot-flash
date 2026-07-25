create table if not exists public.event_email_imports (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  sender text,
  recipient text,
  subject text,
  received_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received','published','review','duplicate','failed')),
  parsed_events jsonb not null default '[]'::jsonb,
  published_event_ids uuid[] not null default '{}',
  error_message text,
  raw_excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_email_imports enable row level security;

create index if not exists event_email_imports_status_idx
  on public.event_email_imports(status, received_at desc);

create unique index if not exists events_external_source_unique
  on public.events(source_name, external_id)
  where source_name is not null and external_id is not null;
