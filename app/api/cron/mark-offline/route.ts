import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { flushEmailOutbox, type OutboxAdmin } from "@/lib/email";

// Marks devices that have stopped reporting as OFFLINE (and queues an alert for devices
// in Lost Mode). Schedule this every few minutes with `Authorization: Bearer $CRON_SECRET`.
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

  const { data, error } = await admin.rpc("mark_stale_devices_offline", {
    p_stale_after: "30 minutes",
  });

  if (error) {
    return NextResponse.json({ error: "Could not update device states." }, { status: 500 });
  }

  // Send the offline alerts we just queued. A failure here must not fail the sweep:
  // unsent emails stay queued for /api/cron/send-emails.
  let emails: unknown = null;
  try {
    emails = await flushEmailOutbox(admin as unknown as OutboxAdmin);
  } catch {
    emails = { error: "email delivery failed; will retry" };
  }

  return NextResponse.json({ ok: true, marked_offline: data ?? 0, emails });
}

export const GET = handle;
export const POST = handle;
