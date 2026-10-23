-- Device credential lifecycle: hashed, revocable, rotatable tokens.
-- Replaces the enrollment_code-based ingestion check from 0003.

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

-- Only one active (non-revoked) credential per device.
create unique index if not exists device_credentials_one_active_per_device_idx
  on public.device_credentials (device_id)
  where revoked_at is null;

-- RLS on with no policies: only the service role (server routes) can touch this table.
alter table public.device_credentials enable row level security;
revoke all on public.device_credentials from anon, authenticated;

-- Issue a new credential for a device owned by p_owner_id, revoking any active one.
create or replace function public.rotate_device_credential(
  p_device_id uuid,
  p_owner_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform 1
    from public.devices
   where id = p_device_id
     and owner_id = p_owner_id
   for update;

  if not found then
    raise exception 'Device not found';
  end if;

  update public.device_credentials
     set revoked_at = now()
   where device_id = p_device_id
     and revoked_at is null;

  insert into public.device_credentials (device_id, token_hash)
  values (p_device_id, p_token_hash)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rotate_device_credential(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.rotate_device_credential(uuid, uuid, text)
  to service_role;

-- Ingestion now authenticates with the credential hash instead of enrollment_code.
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
  v_credential public.device_credentials;
  v_event public.location_events;
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

  select *
    into v_credential
    from public.device_credentials
   where device_id = p_device_id
     and token_hash = p_token_hash
     and revoked_at is null;

  if not found then
    raise exception 'Invalid device credential';
  end if;

  select *
    into v_device
    from public.devices
   where id = p_device_id
   for update;

  if not found then
    raise exception 'Invalid device credential';
  end if;

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

  update public.device_credentials
     set last_used_at = now()
   where id = v_credential.id;

  return v_event;
end;
$$;

revoke all on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_device_location(
  uuid, text, double precision, double precision, double precision, integer, timestamptz
) to service_role;
