-- Email notifications: a durable outbox filled by database triggers, drained by
-- /api/cron/send-emails (and opportunistically after a device reconnects).
-- Depends on 0006_payfast_billing.sql.
--
-- Queuing happens in the same transaction as the event that caused it, so a crash
-- cannot lose an alert, and a rolled-back payment never sends a receipt.

------------------------------------------------------------------------
-- 1. Per-user preference. Device alert emails are on by default; billing
--    emails (receipts, failed payments, cancellations) are always sent.
------------------------------------------------------------------------
create table if not exists public.notification_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  email_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "owners can view their notification settings"
  on public.notification_settings for select
  using (auth.uid() = owner_id);

revoke all on public.notification_settings from anon, authenticated;
grant select on public.notification_settings to authenticated;

create or replace function public.set_email_alerts(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notification_settings (owner_id, email_alerts)
  values (v_uid, p_enabled)
  on conflict (owner_id) do update
    set email_alerts = excluded.email_alerts, updated_at = now();

  return p_enabled;
end;
$$;

revoke all on function public.set_email_alerts(boolean) from public, anon;
grant execute on function public.set_email_alerts(boolean) to authenticated;

------------------------------------------------------------------------
-- 2. Outbox (server only)
------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'DEVICE_RECONNECTED', 'DEVICE_WENT_OFFLINE', 'LOST_MODE_ENABLED', 'LOST_MODE_DISABLED',
    'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'SUBSCRIPTION_CANCELED'
  )),
  payload jsonb not null default '{}'::jsonb,
  -- One email per source event, even if a trigger or webhook is replayed.
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox (id)
  where sent_at is null;

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

------------------------------------------------------------------------
-- 3. Triggers that queue mail
------------------------------------------------------------------------
create or replace function public.queue_alert_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_device_name text;
begin
  v_kind := case new.kind
    when 'RECONNECTED' then 'DEVICE_RECONNECTED'
    when 'WENT_OFFLINE' then 'DEVICE_WENT_OFFLINE'
    when 'LOST_MODE_ENABLED' then 'LOST_MODE_ENABLED'
    when 'LOST_MODE_DISABLED' then 'LOST_MODE_DISABLED'
  end;

  if v_kind is null then
    return new;
  end if;

  if not coalesce(
       (select s.email_alerts from public.notification_settings s where s.owner_id = new.owner_id),
       true
     ) then
    return new;
  end if;

  select d.name into v_device_name from public.devices d where d.id = new.device_id;

  insert into public.email_outbox (owner_id, kind, payload, dedupe_key)
  values (
    new.owner_id,
    v_kind,
    jsonb_build_object(
      'device_id', new.device_id,
      'device_name', coalesce(v_device_name, 'Your device'),
      'at', new.created_at
    ),
    'alert:' || new.id
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists device_alerts_queue_email on public.device_alerts;
create trigger device_alerts_queue_email
  after insert on public.device_alerts
  for each row execute function public.queue_alert_email();

-- Deferred to commit so the subscription row written later in the same transaction
-- is visible, and so a rolled-back payment never sends a receipt.
create or replace function public.queue_payment_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_plan text;
begin
  if new.owner_id is null then
    return null;
  end if;

  v_kind := case
    when new.payment_status = 'COMPLETE' then 'PAYMENT_RECEIVED'
    when new.payment_status = 'FAILED' then 'PAYMENT_FAILED'
    -- A CANCELLED notice without a token is an abandoned checkout, not a subscription.
    when new.payment_status = 'CANCELLED' and new.payfast_token is not null then 'SUBSCRIPTION_CANCELED'
  end;

  if v_kind is null then
    return null;
  end if;

  select s.plan into v_plan from public.subscriptions s where s.owner_id = new.owner_id;

  insert into public.email_outbox (owner_id, kind, payload, dedupe_key)
  values (
    new.owner_id,
    v_kind,
    jsonb_build_object(
      'amount', new.amount_gross,
      'plan', v_plan,
      'period_end', (select s.current_period_end from public.subscriptions s where s.owner_id = new.owner_id),
      'at', new.created_at
    ),
    'payment:' || new.id
  )
  on conflict (dedupe_key) do nothing;

  return null;
end;
$$;

drop trigger if exists billing_payments_queue_email on public.billing_payments;
create constraint trigger billing_payments_queue_email
  after insert on public.billing_payments
  deferrable initially deferred
  for each row execute function public.queue_payment_email();

------------------------------------------------------------------------
-- 4. Draining the outbox (server only)
--    claim: lease rows to one worker (a crashed worker's rows come back after
--    the lease) and count the attempt. finish: record success, or the error.
------------------------------------------------------------------------
create or replace function public.claim_email_outbox(
  p_limit integer default 20,
  p_lease interval default interval '5 minutes'
)
returns setof public.email_outbox
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id
      from public.email_outbox
     where sent_at is null
       and attempts < 5
       and (claimed_at is null or claimed_at < now() - p_lease)
     order by id
     limit greatest(1, least(p_limit, 100))
       for update skip locked
  )
  update public.email_outbox o
     set claimed_at = now(),
         attempts = o.attempts + 1
    from picked
   where o.id = picked.id
  returning o.*;
$$;

revoke all on function public.claim_email_outbox(integer, interval) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer, interval) to service_role;

create or replace function public.finish_email(
  p_id bigint,
  p_error text default null,
  p_permanent boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_outbox
     set sent_at = case when p_error is null then now() else null end,
         last_error = left(p_error, 500),
         -- A permanent failure (bad address, rejected request) is not retried.
         attempts = case when p_error is not null and p_permanent then 5 else attempts end
   where id = p_id;
$$;

revoke all on function public.finish_email(bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.finish_email(bigint, text, boolean) to service_role;

------------------------------------------------------------------------
-- 5. Ingestion reports whether it queued an alert, so the route can send the
--    email straight away instead of waiting for the next scheduled run.
--    (Same function as 0005 with one extra field in the result.)
------------------------------------------------------------------------
create or replace function public.ingest_device_location(
  p_device_id uuid,
  p_token_hash text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_battery_pct integer default null,
  p_recorded_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.devices;
  v_credential public.device_credentials;
  v_event public.location_events;
  v_reconnected boolean;
  v_alerted boolean := false;
begin
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates';
  end if;

  if p_accuracy_m is not null and p_accuracy_m < 0 then
    raise exception 'Invalid accuracy';
  end if;

  if p_battery_pct is not null and (p_battery_pct < 0 or p_battery_pct > 100) then
    raise exception 'Invalid battery percentage';
  end if;

  select * into v_credential
    from public.device_credentials
   where device_id = p_device_id
     and token_hash = p_token_hash
     and revoked_at is null;

  if not found then
    raise exception 'Invalid device credential';
  end if;

  select * into v_device
    from public.devices
   where id = p_device_id
   for update;

  if not found then
    raise exception 'Invalid device credential';
  end if;

  v_reconnected := v_device.status <> 'ONLINE';

  insert into public.location_events (
    device_id, owner_id, latitude, longitude, accuracy_m, battery_pct, recorded_at
  )
  values (
    v_device.id, v_device.owner_id, p_latitude, p_longitude,
    p_accuracy_m, p_battery_pct, coalesce(p_recorded_at, now())
  )
  returning * into v_event;

  update public.devices
     set status = 'ONLINE',
         battery_pct = p_battery_pct,
         last_seen_at = coalesce(p_recorded_at, now()),
         last_latitude = p_latitude,
         last_longitude = p_longitude,
         last_location_accuracy_m = p_accuracy_m,
         -- "Alert me when online" is one-shot; Lost Mode always alerts.
         notify_on_reconnect = case when v_reconnected then false else notify_on_reconnect end,
         updated_at = now()
   where id = v_device.id;

  if v_reconnected and (v_device.notify_on_reconnect or v_device.lost_mode) then
    insert into public.device_alerts (device_id, owner_id, kind, message)
    values (
      v_device.id,
      v_device.owner_id,
      'RECONNECTED',
      v_device.name || ' is back online and reported a fresh location.'
    );
    v_alerted := true;
  end if;

  update public.device_credentials
     set last_used_at = now()
   where id = v_credential.id;

  return jsonb_build_object(
    'event_id', v_event.id,
    'lost_mode', v_device.lost_mode,
    'lost_message', v_device.lost_mode_message,
    'lost_contact', v_device.lost_mode_contact,
    'alert_queued', v_alerted,
    -- Hint for the authorized companion: report more often while the owner is searching.
    'report_interval_s', case when v_device.lost_mode then 60 else 900 end
  );
end;
$$;
