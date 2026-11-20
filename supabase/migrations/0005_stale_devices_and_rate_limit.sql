-- Stale-device detection and per-device ingestion rate limiting.

-- Marks devices that claim to be ONLINE but have not reported recently as OFFLINE.
-- Keep the default in sync with STALE_AFTER_MINUTES in lib/device-status.ts.
create or replace function public.mark_stale_devices(
  p_stale_after interval default interval '15 minutes'
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
     and (last_seen_at is null or last_seen_at < now() - p_stale_after);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_stale_devices(interval) from public, anon, authenticated;
grant execute on function public.mark_stale_devices(interval) to service_role;

-- Replaces the 0004 version (same signature). Changes:
--  * the device row is locked first, so concurrent reports for one device are serialized
--  * a device may report at most once every 5 seconds (12 per minute)
--  * failures use distinct error codes so the API can answer 401 / 429 / 400 correctly:
--      FI401 = invalid, revoked or expired credential
--      FI429 = reporting too fast
--      FI400 = invalid values
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
  v_last_used timestamptz;
  v_event public.location_events;
begin
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates' using errcode = 'FI400';
  end if;

  if p_accuracy_m is not null and p_accuracy_m < 0 then
    raise exception 'Invalid accuracy' using errcode = 'FI400';
  end if;

  if p_battery_pct is not null and (p_battery_pct < 0 or p_battery_pct > 100) then
    raise exception 'Invalid battery percentage' using errcode = 'FI400';
  end if;

  select *
    into v_device
    from public.devices
   where id = p_device_id
   for update;

  if not found then
    raise exception 'Invalid device credential' using errcode = 'FI401';
  end if;

  select c.id, c.last_used_at
    into v_credential_id, v_last_used
    from public.device_credentials c
   where c.device_id = p_device_id
     and c.token_hash = p_token_hash
     and c.revoked_at is null
     and c.expires_at > now();

  if v_credential_id is null then
    raise exception 'Invalid device credential' using errcode = 'FI401';
  end if;

  if v_last_used is not null and v_last_used > now() - interval '5 seconds' then
    raise exception 'Rate limit exceeded' using errcode = 'FI429';
  end if;

  update public.device_credentials
     set last_used_at = now()
   where id = v_credential_id;

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
         updated_at = now()
   where id = v_device.id;

  return v_event;
end;
$$;

revoke all on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) to service_role;
