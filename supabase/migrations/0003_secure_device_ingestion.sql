create or replace function public.ingest_device_location(
  p_device_id uuid,
  p_enrollment_code text,
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
    into v_device
    from public.devices
   where id = p_device_id
     and enrollment_code = p_enrollment_code
   for update;

  if not found then
    raise exception 'Invalid device enrollment';
  end if;

  insert into public.location_events (
    device_id,
    owner_id,
    latitude,
    longitude,
    accuracy_m,
    battery_pct,
    recorded_at
  )
  values (
    v_device.id,
    v_device.owner_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_battery_pct,
    coalesce(p_recorded_at, now())
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
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_device_location(
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz
) to service_role;