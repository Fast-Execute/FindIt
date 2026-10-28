-- Admin console: who counts as an admin, and the read-only queries it may run.
-- Depends on 0007_email_notifications.sql.
--
-- Access is decided here, in the database, not in the UI. The hidden "tap the F"
-- shortcut only navigates to /admin; every admin function below refuses anyone who
-- is not in admin_users, so a mistake in the page code cannot leak data.
--
-- Nothing here returns device locations. Admins see account, billing and delivery
-- health, never where a customer's device is.

------------------------------------------------------------------------
-- 1. Allowlist. Only the service role / SQL editor can change it.
--    Add yourself with (run once in the Supabase SQL editor):
--      insert into public.admin_users (user_id)
--      select id from auth.users where email = 'you@example.com';
------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Internal guard. Looks like "not found" so the console's existence is not confirmed.
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin() from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. Read-only queries for the console
------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'devices_total', (select count(*) from public.devices),
    'devices_online', (select count(*) from public.devices where status = 'ONLINE'),
    'devices_lost_mode', (select count(*) from public.devices where lost_mode),
    'subscribers', (
      select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb)
        from (select plan, count(*) as n
                from public.subscriptions
               where status in ('ACTIVE', 'PAST_DUE')
               group by plan) s
    ),
    'past_due', (select count(*) from public.subscriptions where status = 'PAST_DUE'),
    'mrr_zar', (select coalesce(sum(recurring_amount_zar), 0) from public.subscriptions where status = 'ACTIVE'),
    'revenue_30d_zar', (
      select coalesce(sum(amount_gross), 0)
        from public.billing_payments
       where payment_status = 'COMPLETE' and created_at > now() - interval '30 days'
    ),
    'emails_pending', (select count(*) from public.email_outbox where sent_at is null and attempts < 5),
    'emails_stuck', (select count(*) from public.email_outbox where sent_at is null and attempts >= 5),
    'alerts_24h', (select count(*) from public.device_alerts where created_at > now() - interval '24 hours')
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_recent_users(p_limit integer default 25)
returns table (
  user_id uuid,
  user_email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  plan text,
  device_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
  select u.id,
         u.email::text,
         u.created_at,
         u.last_sign_in_at,
         public.effective_plan(u.id),
         (select count(*) from public.devices d where d.owner_id = u.id)
    from auth.users u
   order by u.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

revoke all on function public.admin_recent_users(integer) from public, anon;
grant execute on function public.admin_recent_users(integer) to authenticated;

create or replace function public.admin_recent_payments(p_limit integer default 25)
returns table (
  payment_id bigint,
  user_email text,
  amount_zar numeric,
  payment_status text,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
  select p.id,
         u.email::text,
         p.amount_gross,
         p.payment_status,
         p.created_at
    from public.billing_payments p
    left join auth.users u on u.id = p.owner_id
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

revoke all on function public.admin_recent_payments(integer) from public, anon;
grant execute on function public.admin_recent_payments(integer) to authenticated;

-- Emails that failed at least once and are not sent yet, newest first.
create or replace function public.admin_email_problems(p_limit integer default 25)
returns table (
  outbox_id bigint,
  kind text,
  user_email text,
  attempts integer,
  last_error text,
  queued_at timestamptz,
  gave_up boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
  select o.id,
         o.kind,
         u.email::text,
         o.attempts,
         o.last_error,
         o.created_at,
         o.attempts >= 5
    from public.email_outbox o
    left join auth.users u on u.id = o.owner_id
   where o.sent_at is null
     and (o.attempts >= 5 or o.last_error is not null)
   order by o.id desc
   limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

revoke all on function public.admin_email_problems(integer) from public, anon;
grant execute on function public.admin_email_problems(integer) to authenticated;
