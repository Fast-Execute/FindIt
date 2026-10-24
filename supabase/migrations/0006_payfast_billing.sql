-- PayFast subscription billing.
-- Depends on 0005_lost_mode_alerts_and_plans.sql.
--
-- Money flow: the server creates a billing_checkout (the server decides plan and
-- amount, never the client), PayFast takes payment, then PayFast's ITN webhook
-- calls apply_payfast_itn() which is the only thing that can activate a plan.

------------------------------------------------------------------------
-- 1. Subscription columns
------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists payfast_token text unique,
  add column if not exists recurring_amount_zar numeric(10,2);

-- The browser has no need for provider tokens.
revoke select on public.subscriptions from anon, authenticated;
grant select (id, owner_id, plan, status, provider, current_period_end, created_at, updated_at)
  on public.subscriptions to authenticated;

------------------------------------------------------------------------
-- 2. Checkouts (what we asked PayFast to charge) and payments (what PayFast told us)
------------------------------------------------------------------------
create table if not exists public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('BASIC', 'PLUS', 'FAMILY')),
  amount_zar numeric(10,2) not null check (amount_zar > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists billing_checkouts_owner_idx on public.billing_checkouts (owner_id);

create table if not exists public.billing_payments (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete set null,
  pf_payment_id text not null,
  m_payment_id uuid,
  payment_status text not null check (payment_status in ('COMPLETE', 'FAILED', 'PENDING', 'CANCELLED')),
  amount_gross numeric(10,2),
  payfast_token text,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  -- A cancellation notice can reuse the original pf_payment_id, so status is part of the key.
  unique (pf_payment_id, payment_status)
);

create index if not exists billing_payments_owner_created_idx
  on public.billing_payments (owner_id, created_at desc);

alter table public.billing_checkouts enable row level security;
alter table public.billing_payments enable row level security;

-- Checkouts are server-only. Owners may read their own payment history (not the raw payload).
revoke all on public.billing_checkouts from anon, authenticated;
revoke all on public.billing_payments from anon, authenticated;

create policy "owners can view their payments"
  on public.billing_payments for select
  using (auth.uid() = owner_id);

grant select (id, owner_id, pf_payment_id, payment_status, amount_gross, created_at)
  on public.billing_payments to authenticated;

------------------------------------------------------------------------
-- 3. Plan resolution with period awareness.
--    ACTIVE and PAST_DUE keep access for a 7 day grace after the paid period
--    (covers a retried renewal or a missed webhook, but not forever).
--    CANCELED keeps access until the period the customer already paid for ends.
------------------------------------------------------------------------
create or replace function public.effective_plan(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
              when s.status = 'ACTIVE'
                   and (s.current_period_end is null
                        or s.current_period_end + interval '7 days' > now()) then s.plan
              when s.status = 'PAST_DUE'
                   and s.current_period_end + interval '7 days' > now() then s.plan
              when s.status = 'CANCELED'
                   and s.current_period_end > now() then s.plan
              else 'FREE'
            end
       from public.subscriptions s
      where s.owner_id = p_owner_id),
    'FREE'
  );
$$;

revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;

drop function if exists public.my_plan_status();

create or replace function public.my_plan_status()
returns table (
  plan text,
  subscription_status text,
  max_devices integer,
  device_count integer,
  lost_mode boolean,
  reconnect_alerts boolean,
  current_period_end timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.plan,
         coalesce((select s.status from public.subscriptions s where s.owner_id = auth.uid()), 'NONE'),
         l.max_devices,
         (select count(*)::integer from public.devices d where d.owner_id = auth.uid()),
         l.lost_mode,
         l.reconnect_alerts,
         (select s.current_period_end from public.subscriptions s where s.owner_id = auth.uid())
    from (select public.effective_plan(auth.uid()) as plan) p,
         public.plan_limits(p.plan) l;
$$;

revoke all on function public.my_plan_status() from public, anon;
grant execute on function public.my_plan_status() to authenticated;

------------------------------------------------------------------------
-- 4. Starting a checkout (server only)
------------------------------------------------------------------------
create or replace function public.begin_checkout(
  p_owner_id uuid,
  p_plan text,
  p_amount_zar numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_plan not in ('BASIC', 'PLUS', 'FAMILY') then
    raise exception 'Unknown plan';
  end if;

  if exists (
    select 1 from public.subscriptions
     where owner_id = p_owner_id
       and status in ('ACTIVE', 'PAST_DUE')
  ) then
    raise exception 'SUBSCRIPTION_ACTIVE: You already have an active subscription. Cancel it before choosing a different plan.';
  end if;

  insert into public.billing_checkouts (owner_id, plan, amount_zar)
  values (p_owner_id, p_plan, p_amount_zar)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.begin_checkout(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.begin_checkout(uuid, text, numeric) to service_role;

------------------------------------------------------------------------
-- 5. Applying a verified PayFast ITN (server only).
--    The route verifies signature, source and PayFast's own confirmation first;
--    this function then enforces the amount and applies the result atomically.
--    Returns APPLIED, RECORDED (nothing to change) or DUPLICATE.
------------------------------------------------------------------------
create or replace function public.apply_payfast_itn(
  p_m_payment_id uuid,
  p_pf_payment_id text,
  p_status text,
  p_amount numeric,
  p_token text,
  p_raw jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_checkout public.billing_checkouts;
  v_have_sub boolean := false;
  v_have_checkout boolean := false;
  v_owner uuid;
  v_expected numeric;
  v_inserted integer;
begin
  if p_status not in ('COMPLETE', 'FAILED', 'PENDING', 'CANCELLED') then
    raise exception 'Unknown payment status';
  end if;

  if p_pf_payment_id is null or length(p_pf_payment_id) = 0 then
    raise exception 'Missing pf_payment_id';
  end if;

  -- Renewals arrive with the subscription token; first payments reference our checkout.
  if p_token is not null and length(p_token) > 0 then
    select * into v_sub from public.subscriptions where payfast_token = p_token for update;
    v_have_sub := found;
  end if;

  if not v_have_sub and p_m_payment_id is not null then
    select * into v_checkout from public.billing_checkouts where id = p_m_payment_id for update;
    v_have_checkout := found;
  end if;

  if v_have_sub then
    v_owner := v_sub.owner_id;
    v_expected := v_sub.recurring_amount_zar;
  elsif v_have_checkout then
    v_owner := v_checkout.owner_id;
    v_expected := v_checkout.amount_zar;
  else
    raise exception 'Unknown payment reference';
  end if;

  insert into public.billing_payments (
    owner_id, pf_payment_id, m_payment_id, payment_status, amount_gross, payfast_token, raw
  )
  values (v_owner, p_pf_payment_id, p_m_payment_id, p_status, p_amount, nullif(p_token, ''), p_raw)
  on conflict (pf_payment_id, payment_status) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'DUPLICATE';
  end if;

  if p_status = 'COMPLETE' then
    if p_amount is null or v_expected is null or abs(p_amount - v_expected) > 0.01 then
      raise exception 'Amount mismatch';
    end if;

    if v_have_sub then
      update public.subscriptions
         set status = 'ACTIVE',
             current_period_end = greatest(coalesce(current_period_end, now()), now()) + interval '1 month',
             updated_at = now()
       where id = v_sub.id;
    else
      if p_token is null or length(p_token) = 0 then
        raise exception 'Missing subscription token';
      end if;

      insert into public.subscriptions (
        owner_id, plan, status, provider, provider_subscription_id,
        payfast_token, recurring_amount_zar, current_period_end
      )
      values (
        v_owner, v_checkout.plan, 'ACTIVE', 'payfast', p_token,
        p_token, v_checkout.amount_zar, now() + interval '1 month'
      )
      on conflict (owner_id) do update
        set plan = excluded.plan,
            status = 'ACTIVE',
            provider = 'payfast',
            provider_subscription_id = excluded.provider_subscription_id,
            payfast_token = excluded.payfast_token,
            recurring_amount_zar = excluded.recurring_amount_zar,
            -- Re-subscribing while a cancelled period is still paid for keeps those days.
            current_period_end = greatest(coalesce(public.subscriptions.current_period_end, now()), now())
                                 + interval '1 month',
            updated_at = now();

      update public.billing_checkouts
         set status = 'COMPLETE', completed_at = now()
       where id = v_checkout.id;
    end if;

    return 'APPLIED';
  end if;

  if p_status = 'FAILED' and v_have_sub then
    update public.subscriptions
       set status = 'PAST_DUE', updated_at = now()
     where id = v_sub.id;
    return 'APPLIED';
  end if;

  if p_status = 'CANCELLED' then
    if v_have_sub then
      update public.subscriptions
         set status = 'CANCELED', updated_at = now()
       where id = v_sub.id;
      return 'APPLIED';
    elsif v_have_checkout then
      update public.billing_checkouts
         set status = 'CANCELLED'
       where id = v_checkout.id and status = 'PENDING';
      return 'APPLIED';
    end if;
  end if;

  return 'RECORDED';
end;
$$;

revoke all on function public.apply_payfast_itn(uuid, text, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_payfast_itn(uuid, text, text, numeric, text, jsonb)
  to service_role;

------------------------------------------------------------------------
-- 6. Owner-initiated cancellation (server only, after PayFast confirms).
--    Access continues until the end of the period already paid for.
------------------------------------------------------------------------
create or replace function public.mark_subscription_canceled(p_owner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
     set status = 'CANCELED', updated_at = now()
   where owner_id = p_owner_id
     and status in ('ACTIVE', 'PAST_DUE');
  return found;
end;
$$;

revoke all on function public.mark_subscription_canceled(uuid) from public, anon, authenticated;
grant execute on function public.mark_subscription_canceled(uuid) to service_role;
