# FindIt

FindIt is a consent-based device recovery platform designed to help people locate and protect their own enrolled devices.

## Product principle

FindIt does not secretly locate phones or bypass device security. A device must be enrolled and authorized by its owner (or an authorized account administrator).

A web service cannot universally live-track a phone after it has been completely powered off. FindIt therefore separates:

- **Live location** — authorized location reported while the device is online.
- **Last known location** — the most recent authorized location before the device went offline.
- **Offline recovery** — integrations with legitimate operating-system/vendor capabilities where available.
- **Reconnect alerts** — notify the account when an enrolled device becomes reachable again.

## Planned stack

- Next.js + TypeScript
- Responsive web dashboard
- Authentication and device enrollment
- Subscription billing
- Location event storage
- Lost-device mode and reconnect alerts
- Privacy, consent, and audit controls

## Development progress

**Phase 1 — Foundation: 85%**

- [x] Repository verified and initialized
- [x] Product safety/consent model defined
- [x] Core location states defined
- [x] Web application scaffold
- [x] Supabase authentication foundation
- [x] Subscription data model foundation
- [x] Device enrollment flow and protected device detail page
- [x] Location dashboard UI
- [x] Secure device location ingestion foundation
- [x] Device token lifecycle (hashed, revocable, rotatable credentials)
- [x] Lost mode and in-app reconnect alerts
- [x] Plan limits enforced in the database (device count, Lost Mode, reconnect alerts)
- [ ] Native companion
- [ ] Billing provider checkout and webhooks
- [ ] Email/push delivery of alerts
- [ ] Production deployment

## Local development

The application scaffold will be added in the next implementation step.


## Supabase setup

The project now includes cookie-based Supabase Auth, protected dashboard routing, and the initial Postgres schema for devices, location events, and subscriptions.

Set these variables locally in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The database migrations are in `supabase/migrations/0001_initial.sql`, `0002_device_enrollment.sql`, `0003_secure_device_ingestion.sql`, `0004_device_credentials.sql`, and `0005_lost_mode_alerts_and_plans.sql`.

Device credentials are random tokens stored only as SHA-256 hashes in `device_credentials`. Each device has at most one active credential; issuing a new one through `POST /api/device/credential` revokes the previous one. Location ingestion (`POST /api/device/location`) authenticates with `Authorization: Bearer <token>` and requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

Real device location collection is implemented as a secured ingestion foundation for an explicitly authorized companion/device component. The website remains the recovery dashboard and account layer. Production device credentials should be minted and rotated by the enrollment service before native companion rollout.


## Plans and access control

What each plan includes is defined once, in `public.plan_limits` (migration 0005), and enforced by the database rather than the UI:

| Plan | Devices | Reconnect alerts | Lost Mode |
| --- | --- | --- | --- |
| Free (no active subscription) | 1 | No | No |
| Basic | 1 | Yes | No |
| Plus | 3 | Yes | Yes |
| Family | 10 | Yes | Yes |

Users cannot write their own `subscriptions` row, flip Lost Mode directly, or forge device state; those changes only happen through the `set_lost_mode`, `set_reconnect_alerts` and ingestion functions. Location ingestion is never plan-gated, so a lapsed subscription cannot cut off recovery of a device that is already enrolled. A billing provider must write `subscriptions` with the service role; that integration is not built yet.

## Scheduled job

Schedule a request to `/api/cron/mark-offline` every few minutes with `Authorization: Bearer $CRON_SECRET`. It marks devices that stopped reporting for 30 minutes as `OFFLINE`. Set `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` on the server (see `.env.example`).

## Companion API

`POST /api/device/location` with `Authorization: Bearer <device token>` returns `lost_mode`, `lost_message`, `lost_contact` and `report_interval_s` (60 while Lost Mode is on, otherwise 900) so the authorized companion can show the owner's message and adjust its reporting rate.
