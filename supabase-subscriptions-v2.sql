-- Hot Flash Milestone 1: subscription billing, payment history, entitlements, and automatic expiry
-- Run after supabase-memberships-and-shops.sql

create table if not exists public.membership_plans (
  code text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  billing_interval text not null check (billing_interval in ('free','month','six_months','year')),
  paypal_plan_id text unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.membership_plans(code,name,price_cents,billing_interval,sort_order)
values
  ('free','Hot Flash Free',0,'free',0),
  ('verified','Hot Flash Verified',199,'month',10),
  ('plus','Hot Flash Plus',499,'month',20),
  ('shop','Verified Shop',5999,'six_months',30)
on conflict (code) do update set
  name=excluded.name, price_cents=excluded.price_cents,
  billing_interval=excluded.billing_interval, sort_order=excluded.sort_order;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.membership_plans(code),
  provider text not null default 'paypal' check (provider in ('paypal','complimentary','manual')),
  provider_subscription_id text unique,
  status text not null default 'approval_pending'
    check (status in ('approval_pending','trialing','active','past_due','suspended','canceled','expired')),
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, created_at desc);
create unique index if not exists subscriptions_one_live_per_user
  on public.subscriptions(user_id)
  where status in ('approval_pending','trialing','active','past_due','suspended');

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  provider_transaction_id text unique,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null check (status in ('completed','pending','failed','refunded','reversed')),
  paid_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_payments_subscription_idx on public.subscription_payments(subscription_id, created_at desc);

create table if not exists public.plan_entitlements (
  plan_code text not null references public.membership_plans(code) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value integer,
  metadata jsonb not null default '{}'::jsonb,
  primary key(plan_code, feature_key)
);

insert into public.plan_entitlements(plan_code,feature_key,enabled,limit_value) values
 ('free','community',true,null),('free','vehicle_profiles',true,null),('free','events',true,null),('free','messaging',true,null),('free','marketplace',true,null),('free','flashtag',true,null),
 ('verified','community',true,null),('verified','vehicle_profiles',true,null),('verified','verified_badge',true,null),('verified','included_decal',true,1),('verified','obd2',true,null),('verified','cruise_plus',true,null),('verified','garage_analytics',true,null),('verified','premium_themes',true,null),
 ('plus','community',true,null),('plus','vehicle_profiles',true,null),('plus','verified_badge',true,null),('plus','included_decal',true,1),('plus','obd2',true,null),('plus','cruise_plus',true,null),('plus','garage_analytics',true,null),('plus','premium_themes',true,null),('plus','extended_obd_logging',true,null),('plus','route_history',true,null),('plus','ai_build_tools',true,null),
 ('shop','community',true,null),('shop','verified_badge',true,null),('shop','included_decal',true,1),('shop','shop_profile',true,null),('shop','shop_ads',true,null),('shop','shop_qa',true,null),('shop','e_tuning',true,null),('shop','shop_analytics',true,null),('shop','shop_events',true,null)
on conflict (plan_code,feature_key) do update set enabled=excluded.enabled, limit_value=excluded.limit_value;

alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.membership_plans enable row level security;
alter table public.plan_entitlements enable row level security;

drop policy if exists "Plans are public" on public.membership_plans;
create policy "Plans are public" on public.membership_plans for select using (active = true);
drop policy if exists "Entitlements are public" on public.plan_entitlements;
create policy "Entitlements are public" on public.plan_entitlements for select using (true);
drop policy if exists "Members view own subscriptions" on public.subscriptions;
create policy "Members view own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "Members view own payments" on public.subscription_payments;
create policy "Members view own payments" on public.subscription_payments for select using (
  exists(select 1 from public.subscriptions s where s.id=subscription_id and s.user_id=auth.uid())
);

create or replace function public.effective_membership(p_user_id uuid)
returns table(plan_code text, subscription_status text, access_ends_at timestamptz)
language sql stable security definer set search_path=public as $$
  select coalesce(s.plan_code,'free'), coalesce(s.status,'inactive'),
         coalesce(s.grace_period_ends_at,s.current_period_end)
  from (select 1) x
  left join lateral (
    select * from public.subscriptions
    where user_id=p_user_id
      and status in ('trialing','active','past_due')
      and (coalesce(grace_period_ends_at,current_period_end) is null or coalesce(grace_period_ends_at,current_period_end)>now())
    order by created_at desc limit 1
  ) s on true;
$$;

grant execute on function public.effective_membership(uuid) to authenticated;

create or replace function public.has_entitlement(p_feature_key text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.plan_entitlements pe
    join public.effective_membership(auth.uid()) em on em.plan_code=pe.plan_code
    where pe.feature_key=p_feature_key and pe.enabled
  ) or exists(select 1 from public.plan_entitlements where plan_code='free' and feature_key=p_feature_key and enabled);
$$;
grant execute on function public.has_entitlement(text) to authenticated;

-- Keep legacy profile fields synchronized for existing UI. Server/webhook code remains source of truth.
create or replace function public.sync_profile_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set
    account_tier = case when new.status in ('trialing','active','past_due') and (coalesce(new.grace_period_ends_at,new.current_period_end) is null or coalesce(new.grace_period_ends_at,new.current_period_end)>now()) then new.plan_code else 'free' end,
    subscription_status = new.status,
    subscription_started_at = new.started_at,
    subscription_ends_at = coalesce(new.grace_period_ends_at,new.current_period_end),
    paypal_subscription_id = case when new.provider='paypal' then new.provider_subscription_id else paypal_subscription_id end,
    verified_at = case when new.plan_code in ('verified','plus','shop') and new.status in ('trialing','active') then coalesce(verified_at,now()) else verified_at end
  where id=new.user_id;
  return new;
end; $$;

drop trigger if exists subscriptions_sync_profile on public.subscriptions;
create trigger subscriptions_sync_profile after insert or update on public.subscriptions
for each row execute function public.sync_profile_membership();

-- Expire stale access. Schedule this daily with pg_cron or call from an admin Edge Function.
create or replace function public.expire_stale_subscriptions()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update public.subscriptions set status='expired', ended_at=coalesce(ended_at,now()), updated_at=now()
  where status in ('active','trialing','past_due','suspended')
    and coalesce(grace_period_ends_at,current_period_end) is not null
    and coalesce(grace_period_ends_at,current_period_end)<=now();
  get diagnostics changed = row_count;
  return changed;
end; $$;