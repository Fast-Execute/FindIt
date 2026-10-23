-- 0004: device credentials, token-based ingestion, and tighter RLS.
--
-- Fixes a mismatch between the API routes and earlier migrations:
--   * /api/device/credential inserts into public.device_credentials, which no
--     migration created.
--   * /api/device/location calls ingest_device_location(p_token_hash => ...),
--     but 0003 defined it with p_enrollment_code.

-- ---------------------------------------------------------------------------
-- Device credentials (hashed bearer tokens, service-role access only)
-- ---------------------------------------------------------------------------

create table if not exists public.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists device_credentials_device_id_idx
  on public.device_credentials (device_id);

-- RLS on with no policies: only the service role (which bypasses RLS) can touch
-- this table. Token hashes must never be readable from a user session.
alter table public.device_credentials enable row level security;
revoke all on table public.device_credentials from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ingestion function
-- ---------------------------------------------------------------------------

drop function if exists public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
);

create or replace function public.ingest_device_location(
  p_device_id uuid,
  p_token_hash text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_battery_pct integer default null,
  p_recorded_at timestamptz default now()
)
returns public.location_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.devices;
  v_credential_id uuid;
  v_event public.location_events;
  v_recorded_at timestamptz := coalesce(p_recorded_at, now());
begin
  -- Error codes let the API route map failures to HTTP statuses:
  --   28000 -> 401 (bad credential), 22023 -> 400 (bad input), anything else -> 500.
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_accuracy_m is not null and p_accuracy_m < 0 then
    raise exception 'Invalid accuracy' using errcode = '22023';
  end if;

  if p_battery_pct is not null and (p_battery_pct < 0 or p_battery_pct > 100) then
    raise exception 'Invalid battery percentage' using errcode = '22023';
  end if;

  -- Allow a little clock skew, but never accept events from the future.
  if v_recorded_at > now() + interval '5 minutes' then
    raise exception 'recorded_at is in the future' using errcode = '22023';
  end if;

  select c.id
    into v_credential_id
    from public.device_credentials c
   where c.device_id = p_device_id
     and c.token_hash = p_token_hash
     and c.revoked_at is null;

  if v_credential_id is null then
    raise exception 'Invalid device credential' using errcode = '28000';
  end if;

  select *
    into v_device
    from public.devices
   where id = p_device_id
   for update;

  if not found then
    raise exception 'Invalid device credential' using errcode = '28000';
  end if;

  update public.device_credentials
     set last_used_at = now()
   where id = v_credential_id;

  -- Always keep the event in history (devices may upload queued events late)...
  insert into public.location_events (
    device_id, owner_id, latitude, longitude, accuracy_m, battery_pct, recorded_at
  )
  values (
    v_device.id, v_device.owner_id, p_latitude, p_longitude,
    p_accuracy_m, p_battery_pct, v_recorded_at
  )
  returning * into v_event;

  -- ...but only let it become the device's "last known" state if it is not older
  -- than what we already have, so a delayed upload can't roll the dashboard back.
  if v_device.last_seen_at is null or v_recorded_at >= v_device.last_seen_at then
    update public.devices
       set status = 'ONLINE',
           battery_pct = p_battery_pct,
           last_seen_at = v_recorded_at,
           last_latitude = p_latitude,
           last_longitude = p_longitude,
           last_location_accuracy_m = p_accuracy_m,
           updated_at = now()
     where id = v_device.id;
  end if;

  return v_event;
end;
$$;

revoke all on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- Offline detection
-- ---------------------------------------------------------------------------

-- ONLINE is only ever set by ingestion, so without this a device would show
-- ONLINE forever. Run it on a schedule (e.g. pg_cron every few minutes):
--   select cron.schedule('findit-mark-offline', '*/5 * * * *',
--     $$select public.mark_stale_devices_offline()$$);
create or replace function public.mark_stale_devices_offline(
  p_threshold interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.devices
     set status = 'OFFLINE',
         updated_at = now()
   where status = 'ONLINE'
     and (last_seen_at is null or last_seen_at < now() - p_threshold);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_stale_devices_offline(interval)
  from public, anon, authenticated;
grant execute on function public.mark_stale_devices_offline(interval) to service_role;

-- ---------------------------------------------------------------------------
-- Tighten row-level security
-- ---------------------------------------------------------------------------

-- Location history may only be written by the ingestion function, never
-- directly by a signed-in user (otherwise history can be forged).
drop policy if exists "owners can create their location events" on public.location_events;

-- Subscription state must come from the billing provider (service role). With
-- the old policies a user could mark their own subscription ACTIVE.
drop policy if exists "owners can create their subscription" on public.subscriptions;
drop policy if exists "owners can update their subscription" on public.subscriptions;

-- Owners may rename/edit their devices, but not overwrite device-reported state
-- (status, location, battery, last_seen_at) from the client.
revoke insert, update on public.devices from authenticated;
grant insert (id, owner_id, name, model, platform, status, enrollment_code)
  on public.devices to authenticated;
grant update (name, model, platform) on public.devices to authenticated;
