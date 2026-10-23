import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Marks devices that have stopped reporting as OFFLINE.
// Schedule this every few minutes (e.g. Vercel Cron, which sends
// `Authorization: Bearer $CRON_SECRET`).
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!cronSecret || !serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Cron endpoint is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!provided || !secretsMatch(provided, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc("mark_stale_devices_offline", {
    p_stale_after: "30 minutes",
  });

  if (error) {
    return NextResponse.json({ error: "Could not update device states." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marked_offline: data ?? 0 });
}

export const GET = handle;
export const POST = handle;
