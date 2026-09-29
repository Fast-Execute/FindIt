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
- [ ] Lost mode and reconnect alerts
- [ ] Production deployment

## Local development

The application scaffold will be added in the next implementation step.


## Supabase setup

The project now includes cookie-based Supabase Auth, protected dashboard routing, and the initial Postgres schema for devices, location events, and subscriptions.

Set these variables locally in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The database migration is in `supabase/migrations/0001_initial.sql`.

Real device location collection will be implemented through an explicitly authorized companion/device component. The website itself is the recovery dashboard and account layer.
