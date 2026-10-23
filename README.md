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

**Phase 1 — Foundation: 75%**

- [x] Repository verified and initialized
- [x] Product safety/consent model defined
- [x] Core location states defined
- [x] Web application scaffold
- [x] Supabase authentication foundation
- [x] Subscription data model foundation
- [x] Device enrollment flow and protected device detail page
- [x] Location dashboard UI
- [x] Secure device location ingestion foundation
- [x] Device credential issuing, rotation and hashed-token ingestion
- [ ] Native companion app
- [ ] Lost mode and reconnect alerts
- [ ] Production deployment

## Local development

Requirements: Node.js 22+ and a [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run lint`, `npx tsc --noEmit`, `npm run build`. CI runs all three on every push and pull request to `main`.

### Environment variables

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Required by `/api/device/credential` and `/api/device/location`. Bypasses RLS: never expose it to the browser |

## Database

Apply the migrations in `supabase/migrations/` in order (Supabase CLI: `supabase db push`, or paste each file into the SQL editor):

| Migration | Purpose |
| --- | --- |
| `0001_initial.sql` | `devices`, `location_events`, `subscriptions`, owner-only RLS |
| `0002_device_enrollment.sql` | Enrollment code on devices |
| `0003_secure_device_ingestion.sql` | First ingestion function (superseded by 0004) |
| `0004_device_credentials.sql` | `device_credentials` (hashed tokens), token-based `ingest_device_location`, `mark_stale_devices_offline`, tighter RLS and column grants |

Devices only ever show `ONLINE` when ingestion has just recorded an event. To flip silent devices to `OFFLINE`, schedule `select public.mark_stale_devices_offline();` (for example with `pg_cron` every 5 minutes).

## Device API

Real device location collection is a secured ingestion foundation for an explicitly authorized companion/device component. The website remains the recovery dashboard and account layer.

**`POST /api/device/credential`** (signed-in owner session) with `{ "device_id": "<uuid>" }` returns a bearer token **once**. Only its SHA-256 hash is stored. Calling it again rotates the credential and revokes the previous one.

**`POST /api/device/location`** with `Authorization: Bearer <token>` and a JSON body:

```json
{
  "device_id": "<uuid>",
  "latitude": -25.7479,
  "longitude": 28.2293,
  "accuracy_m": 12,
  "battery_pct": 80,
  "recorded_at": "2026-10-23T07:20:00Z"
}
```

`accuracy_m`, `battery_pct` and `recorded_at` are optional. Responses: `200` recorded, `400` invalid payload, `401` missing/invalid/revoked credential, `413` body too large, `503` service not configured. Events older than the device's current last-seen time are stored in history but do not overwrite its last known state.
