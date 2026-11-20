import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function secretMatches(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Persists OFFLINE for devices that stopped reporting. Call it on a schedule
// (for example every 5 minutes) with `Authorization: Bearer <CRON_SECRET>`.
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!cronSecret || !serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Stale-device job is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!provided || !secretMatches(provided, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("mark_stale_devices");
  if (error) {
    return NextResponse.json({ error: "Could not update stale devices." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marked_offline: data ?? 0 });
}

export const GET = handle;
export const POST = handle;
