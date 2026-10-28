-- 0004_device_credentials.sql
-- Adds hashed, expiring, revocable device credentials and aligns
-- ingest_device_location with the API route (p_token_hash).

create table if not exists public.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year'),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists device_credentials_device_id_idx
  on public.device_credentials (device_id);

-- RLS on with no policies: only service_role can access.
alter table public.device_credentials enable row level security;

-- Owners must not insert fake location events directly.
drop policy if exists "owners can create their location events" on public.location_events;

drop function if exists public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
);

create function public.ingest_device_location(
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
  v_cred public.device_credentials;
  v_event public.location_events;
  v_recorded_at timestamptz := coalesce(p_recorded_at, now());
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
  if v_recorded_at > now() + interval '5 minutes' then
    raise exception 'Invalid timestamp';
  end if;

  select * into v_cred
    from public.device_credentials
   where device_id = p_device_id
     and token_hash = p_token_hash
     and revoked_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Invalid device credential';
  end if;

  select * into v_device from public.devices where id = p_device_id for update;
  if not found then
    raise exception 'Invalid device credential';
  end if;

  insert into public.location_events (
    device_id, owner_id, latitude, longitude, accuracy_m, battery_pct, recorded_at
  ) values (
    v_device.id, v_device.owner_id, p_latitude, p_longitude, p_accuracy_m, p_battery_pct, v_recorded_at
  ) returning * into v_event;

  update public.devices
     set status = 'ONLINE',
         battery_pct = p_battery_pct,
         last_seen_at = v_recorded_at,
         last_latitude = p_latitude,
         last_longitude = p_longitude,
         last_location_accuracy_m = p_accuracy_m,
         updated_at = now()
   where id = v_device.id;

  update public.device_credentials set last_used_at = now() where id = v_cred.id;

  return v_event;
end;
$$;

revoke all on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) to service_role;
