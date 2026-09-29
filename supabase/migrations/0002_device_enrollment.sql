alter table public.devices
  add column if not exists enrollment_code text unique;

create index if not exists devices_enrollment_code_idx
  on public.devices (enrollment_code);