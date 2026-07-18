-- PayPal webhook event ledger for idempotent subscription processing
-- Run after supabase-subscriptions-v2.sql

create table if not exists public.paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_subscription_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists paypal_webhook_subscription_idx
  on public.paypal_webhook_events(provider_subscription_id, processed_at desc);

alter table public.paypal_webhook_events enable row level security;

-- No public policies: only service-role Edge Functions may read or write this table.
