-- 0006_device_credential_expiry.sql
-- Adds token expiry to device credentials. Safe to re-run.

alter table public.device_credentials
  add column if not exists expires_at timestamptz;

-- Existing tokens get one year from their creation date.
update public.device_credentials
   set expires_at = created_at + interval '1 year'
 where expires_at is null;

alter table public.device_credentials
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '1 year');

-- Speeds up the "active, unexpired token" lookup.
create index if not exists device_credentials_expires_at_idx
  on public.device_credentials (expires_at);
