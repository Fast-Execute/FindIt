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
- [x] PayFast subscription billing (checkout, signed webhook, cancel, billing page)
- [x] Email delivery of alerts, receipts and payment problems
- [ ] Push notifications
- [ ] Production deployment

## Local development

The application scaffold will be added in the next implementation step.


## Supabase setup

The project now includes cookie-based Supabase Auth, protected dashboard routing, and the initial Postgres schema for devices, location events, and subscriptions.

Set these variables locally in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The database migrations are in `supabase/migrations/0001_initial.sql`, `0002_device_enrollment.sql`, `0003_secure_device_ingestion.sql`, `0004_device_credentials.sql`, `0005_lost_mode_alerts_and_plans.sql`, `0006_payfast_billing.sql`, `0007_email_notifications.sql`, and `0008_admin_console.sql`.

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

Users cannot write their own `subscriptions` row, flip Lost Mode directly, or forge device state; those changes only happen through the `set_lost_mode`, `set_reconnect_alerts` and ingestion functions. Location ingestion is never plan-gated, so a lapsed subscription cannot cut off recovery of a device that is already enrolled. Only the PayFast webhook (service role) can activate a plan; see Billing below.

## Scheduled job

Schedule a request to `/api/cron/mark-offline` every few minutes with `Authorization: Bearer $CRON_SECRET`. It marks devices that stopped reporting for 30 minutes as `OFFLINE`. Set `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` on the server (see `.env.example`).

## Companion API

`POST /api/device/location` with `Authorization: Bearer <device token>` returns `lost_mode`, `lost_message`, `lost_contact` and `report_interval_s` (60 while Lost Mode is on, otherwise 900) so the authorized companion can show the owner's message and adjust its reporting rate.


## Billing (PayFast)

Prices live in one place, `lib/pricing.ts` (rand, monthly): the landing page, billing page and the charge itself all read it, and the client never sends an amount.

Flow: the billing page calls `POST /api/billing/checkout`, which records a `billing_checkouts` row (plan and amount decided by the server) and returns a signed PayFast form. PayFast takes the card, then calls `POST /api/billing/payfast/notify` (ITN). That route is the only way a plan becomes active and it checks, in order: the request comes from a PayFast server, the merchant id is ours, the signature is valid, and PayFast itself confirms the notification. `apply_payfast_itn` then enforces the expected amount and ignores duplicates in one transaction. Renewals arrive with the subscription token; a failed renewal marks the account `PAST_DUE` (7 days of grace), and cancelling keeps access until the paid period ends. Users cannot read provider tokens or write subscriptions.

Set up:

1. Create a PayFast merchant account and set a **passphrase** in the PayFast dashboard (Settings, Integration). Enable subscriptions/recurring billing for the account.
2. Set `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` and `NEXT_PUBLIC_SITE_URL` (your public https URL, since PayFast must reach `/api/billing/payfast/notify`).
3. The app runs against the PayFast **sandbox** unless `PAYFAST_MODE=live`. Test with sandbox credentials first, including a renewal, a cancel and a failed payment, before switching to live.
4. For local sandbox testing without a public URL, `PAYFAST_SKIP_IP_CHECK=true` skips only the source-IP check, and only in sandbox mode. Signature and PayFast confirmation still run.

Run the unit tests with `node --test lib/payfast.test.mjs` (Node 22.18 or newer).


## Email

Alerts and billing events are written to an `email_outbox` table by database triggers, in the same transaction as the event, so an alert cannot be lost and a rolled-back payment never sends a receipt. `lib/email.ts` renders and sends them through [Resend](https://resend.com); swapping provider means replacing `buildSendRequest` and `classifyStatus` in that one file.

| Email | Sent when | Can be turned off |
| --- | --- | --- |
| Device back online | A device reconnects and "alert me" or Lost Mode is on | Yes (Settings) |
| Device went offline | A Lost Mode device stops reporting | Yes |
| Lost Mode on / off | The owner changes it (doubles as a security notice) | Yes |
| Payment received, payment failed, subscription cancelled | PayFast notifies us | No |

Reconnect emails are sent right after the device's request returns. Everything else (and any retries) is sent by `/api/cron/send-emails`, so schedule it every few minutes with `Authorization: Bearer $CRON_SECRET`, along with `/api/cron/mark-offline`. Vercel's Hobby plan only allows daily cron, so use Pro or an external scheduler such as cron-job.org for these.

Set up:

1. Create a Resend account and verify your sending domain (add the DNS records it gives you).
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on that verified domain).
3. If email was misconfigured for a while, rows stop retrying after 5 attempts. After fixing it, requeue them with `update email_outbox set attempts = 0 where sent_at is null;`.

Until both variables are set nothing is sent and nothing is lost: mail stays queued.


## Admin console

A read-only page at `/admin` for the owner: accounts, subscribers, monthly recurring revenue, payments collected, device counts, and email delivery problems. It never shows device locations.

**Opening it:** tap the **F** in the FindIt logo 7 times in a quick run (landing page, login, signup and the dashboard all have it). That is only a shortcut. The real lock is on the server: `/admin` returns a plain 404 to anyone who is not signed in as an admin, and the database itself refuses every admin query from a non-admin (`is_admin()` in migration 0008), so knowing the trick gets nobody in.

**Making yourself an admin** (once, in the Supabase SQL editor; nobody can do this from the app):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'you@example.com';
```

To remove an admin, delete their row; access ends immediately.

Keep this list short and use a strong, unique password on admin accounts. Admins can see customer email addresses and payment amounts. Requiring two-factor sign-in for admins is a sensible next step but is not built yet.
