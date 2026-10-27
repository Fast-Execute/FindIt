-- Lost Mode flag. Reconnect alerts (see ops/n8n) only fire for devices whose owner
-- has explicitly turned this on, so people are never emailed about routine
-- offline/online changes. Owners can already update their own devices under the
-- existing RLS policy; a UI toggle is the remaining work.
alter table public.devices
  add column if not exists lost_mode boolean not null default false;
