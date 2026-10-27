-- Billing foundation.
--
-- SECURITY: 0001 let any signed-in user insert/update their own subscription row,
-- which would let them mark themselves ACTIVE without paying. Subscription state
-- must only be written by the server (service role) after a verified payment
-- provider webhook. Owners keep read-only access.
drop policy if exists "owners can create their subscription" on public.subscriptions;
drop policy if exists "owners can update their subscription" on public.subscriptions;

revoke insert, update, delete on public.subscriptions from anon, authenticated;

alter table public.subscriptions
  add column if not exists price_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists subscriptions_provider_subscription_id_key
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists subscriptions_provider_customer_id_idx
  on public.subscriptions (provider_customer_id);

-- Webhook idempotency: one row per processed payment-provider event id.
-- RLS is enabled with no policies, so only the service role can touch it.
create table if not exists public.billing_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
