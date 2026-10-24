import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { flushEmailOutbox, type OutboxAdmin } from "@/lib/email";

// Sends queued emails (device alerts, receipts). Schedule it every few minutes with
// `Authorization: Bearer $CRON_SECRET`. Reconnect alerts are also sent immediately by
// the location route, so this mostly catches offline alerts, payment emails and retries.
async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron endpoint is not configured." }, { status: 503 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Cron endpoint is not configured." }, { status: 503 });
  }

  const result = await flushEmailOutbox(admin as unknown as OutboxAdmin);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
