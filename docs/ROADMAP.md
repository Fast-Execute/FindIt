# FindIt Roadmap

How to use this file: when a task is finished and verified, change `- [ ] Task` to `- [x] ~~Task~~`
(checked and struck through), then run `node scripts/update-progress.mjs`. That recalculates the
progress bar in `README.md` and rewrites `PROGRESS.md`. Progress = finished tasks / total tasks.

## Phase 1 — Foundation
- [x] ~~Repository, product safety and consent model~~
- [x] ~~Core location states (live, last known, offline, reconnect)~~
- [x] ~~Next.js web scaffold~~
- [x] ~~Landing page, navigation and pricing presentation~~
- [x] ~~CI workflow (type-check and build)~~
- [x] ~~Product documentation (docs/PRODUCT.md)~~

## Phase 2 — Accounts
- [x] ~~Supabase authentication (signup, login, cookie sessions)~~
- [x] ~~Protected dashboard routing~~
- [x] ~~Device enrollment flow and device detail page~~
- [x] ~~Real Settings page (profile name and email from the account, not placeholders)~~
- [x] ~~Password reset flow~~
- [x] ~~Email verification flow~~

## Phase 3 — Subscriptions
- [x] ~~Subscription data model~~
- [x] ~~Replace placeholder subscription UI (dashboard, sidebar) with real data~~
- [ ] Choose billing provider and implement checkout
- [ ] Billing webhooks keep subscription status in sync
- [ ] Cancellation
- [ ] Billing history
- [ ] Plan limits enforced (device slots)

## Phase 4 — Device Recovery
- [x] ~~Device records and location dashboard UI~~
- [x] ~~Secure device location ingestion~~
- [x] ~~Device token lifecycle: expiry, rotation, revocation~~
- [ ] Map provider on the recovery map
- [ ] Location history view per device
- [x] ~~Stale-device detection (mark ONLINE devices OFFLINE when they stop reporting)~~
- [x] ~~Rate limiting on the location ingestion endpoint~~
- [ ] Lost mode
- [ ] Reconnect alerts (notify when an enrolled device is reachable again)

## Phase 5 — Mobile Companion
- [ ] Android companion: permissions, secure token storage, location reporting
- [ ] iOS companion: permissions, secure token storage, location reporting
- [ ] Background reporting that respects battery and OS limits
- [ ] In-app device token provisioning from the dashboard

## Phase 6 — Offline Finding Integrations
- [ ] Evaluate legitimate OS and vendor offline-finding mechanisms
- [ ] Integrate only supported, consent-based mechanisms

## Phase 7 — Production
- [ ] Automated tests for API routes and database functions
- [ ] CI: pin dependency versions and add lint
- [x] ~~Document SUPABASE_SERVICE_ROLE_KEY in .env.example~~
- [ ] Security review
- [ ] Privacy and legal review
- [ ] Monitoring and error reporting
- [ ] Backups and restore test
- [ ] Abuse prevention
- [ ] Production deployment
- [ ] Operational runbooks
