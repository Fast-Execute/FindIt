import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LocationPayload = {
  device_id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy_m?: unknown;
  battery_pct?: unknown;
  recorded_at?: unknown;
};

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Device ingestion is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing device authorization." }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Missing device authorization." }, { status: 401 });
  }

  let body: LocationPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  const latitude = numberOrNull(body.latitude);
  const longitude = numberOrNull(body.longitude);
  const accuracy = numberOrNull(body.accuracy_m);
  const battery = numberOrNull(body.battery_pct);

  if (!deviceId || latitude === null || longitude === null) {
    return NextResponse.json({ error: "device_id, latitude, and longitude are required." }, { status: 400 });
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  if (accuracy !== null && accuracy < 0) {
    return NextResponse.json({ error: "Invalid accuracy." }, { status: 400 });
  }

  if (battery !== null && (!Number.isInteger(battery) || battery < 0 || battery > 100)) {
    return NextResponse.json({ error: "Invalid battery percentage." }, { status: 400 });
  }

  const recordedAt = typeof body.recorded_at === "string" ? body.recorded_at : new Date().toISOString();
  if (Number.isNaN(Date.parse(recordedAt))) {
    return NextResponse.json({ error: "Invalid recorded_at timestamp." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("ingest_device_location", {
    p_device_id: deviceId,
    p_token_hash: tokenHash,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_m: accuracy,
    p_battery_pct: battery,
    p_recorded_at: recordedAt,
  });

  if (error) {
    return NextResponse.json({ error: "Device enrollment could not be verified." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, event_id: data?.id ?? null });
}