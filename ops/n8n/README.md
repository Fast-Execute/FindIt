# FindIt automation with n8n

Two importable workflows send email notifications. They are driven by Supabase Database Webhooks, read data through the Supabase REST/Auth APIs, and send mail over SMTP. **Billing correctness does not depend on n8n**: Stripe webhooks are handled inside the Next.js app (`/api/billing/webhook`), and n8n only reacts to the resulting database changes.

| Workflow | Trigger | Sends |
| --- | --- | --- |
| `workflows/billing-notices.json` | `public.subscriptions` INSERT/UPDATE | Subscription active, payment failed, subscription ended, cancellation scheduled |
| `workflows/reconnect-alert.json` | `public.location_events` INSERT | "Device is back online" email, only when the device has **Lost Mode** on and was silent for at least `gapMinutes` (default 30) |

The reconnect email links to the device page instead of including coordinates, so location data is not sent over email.

## License note

n8n is under the [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md): free for your own internal business use, but you may not sell it or make it part of a commercial offering to customers. Running it as FindIt's own back-office automation is the intended use here. Do not expose n8n, its editor, or its workflows to FindIt customers, and check with n8n if you are unsure about your setup.

## Setup

1. **Start n8n.** In this folder: `cp .env.example .env`, fill it in (`openssl rand -hex 32` for the encryption key), then `docker compose up -d`. It listens on `127.0.0.1:5678`; publish it over HTTPS with a reverse proxy or tunnel at `https://$N8N_HOST` so Supabase can reach the webhooks.
2. **Apply migrations** `0004_billing.sql` and `0005_lost_mode.sql` in Supabase (`0005` adds `devices.lost_mode`).
3. **Create credentials in n8n** (names are what the workflows expect, but you can reselect others):
   - **Supabase API** named `FindIt Supabase`: your project URL and the service-role/secret key. This stays inside n8n, never in the app's client code.
   - **Header Auth** named `FindIt webhook secret`: header name `x-findit-secret`, value a long random string (`openssl rand -hex 32`).
   - **SMTP** named `FindIt SMTP`: your mail provider's SMTP settings.
4. **Import** both files from `workflows/` (Workflows → Import from file). Open each node showing a red credential warning and select the credential above.
5. **Edit the `Config` node** in each workflow: `supabaseUrl`, `siteUrl`, `fromEmail` (and `gapMinutes` for reconnect alerts).
6. **Create the Supabase Database Webhooks** (Dashboard → Integrations → Database Webhooks), method POST, with header `x-findit-secret: <the same secret>`:
   - `findit-subscriptions`: table `public.subscriptions`, events Insert + Update, URL `https://$N8N_HOST/webhook/findit/subscription-change`
   - `findit-location-events`: table `public.location_events`, event Insert, URL `https://$N8N_HOST/webhook/findit/location-event`
7. **Test first.** Run each workflow with "Listen for test event" and the matching `/webhook-test/...` URL, then **activate** both workflows (they import inactive).

## Behavior and limits

- **Reconnect alerts need Lost Mode.** `devices.lost_mode` defaults to false, so nothing is sent until an owner turns it on. The dashboard toggle does not exist yet; until it does, set it directly on the device row.
- **Alert volume.** The reconnect workflow runs once per location event (two REST calls when Lost Mode is on, one lookup otherwise). That is fine at small scale; if devices report often at volume, filter in the webhook (for example only devices in Lost Mode) or move the check into a database function.
- **Admin email lookup.** The workflows read the owner's email from `/auth/v1/admin/users/{id}` with the Supabase credential. If that returns 401 with a new-style `sb_secret_...` key, use the project's legacy `service_role` key in the credential instead.
- **Failures are not retried by Supabase.** If n8n is down, those notifications are skipped. The app's billing state is unaffected.
