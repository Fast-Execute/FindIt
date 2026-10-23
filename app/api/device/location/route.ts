import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation";

type LocationPayload = {
  device_id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy_m?: unknown;
  battery_pct?: unknown;
  recorded_at?: unknown;
};

const MAX_BODY_BYTES = 4096;

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return bad("Device ingestion is not configured.", 503);

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return bad("Missing device authorization.", 401);

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return bad("Missing device authorization.", 401);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return bad("Request body too large.", 413);

  let body: LocationPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return bad("Request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null) return bad("Request body must be a JSON object.");

  if (!isUuid(body.device_id)) return bad("A valid device_id is required.");

  const latitude = numberOrNull(body.latitude);
  const longitude = numberOrNull(body.longitude);
  const accuracy = numberOrNull(body.accuracy_m);
  const battery = numberOrNull(body.battery_pct);

  if (latitude === null || longitude === null) {
    return bad("latitude and longitude are required numbers.");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return bad("Invalid coordinates.");
  }
  if (accuracy !== null && accuracy < 0) return bad("Invalid accuracy.");
  if (battery !== null && (!Number.isInteger(battery) || battery < 0 || battery > 100)) {
    return bad("Invalid battery percentage.");
  }

  const recordedAt = typeof body.recorded_at === "string" ? body.recorded_at : new Date().toISOString();
  const recordedMs = Date.parse(recordedAt);
  if (Number.isNaN(recordedMs)) return bad("Invalid recorded_at timestamp.");
  if (recordedMs > Date.now() + 5 * 60 * 1000) return bad("recorded_at cannot be in the future.");

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await admin.rpc("ingest_device_location", {
    p_device_id: body.device_id,
    p_token_hash: tokenHash,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_m: accuracy,
    p_battery_pct: battery,
    p_recorded_at: recordedAt,
  });

  if (error) {
    // Error codes are set in supabase/migrations/0004_device_credentials.sql.
    if (error.code === "28000") return bad("Device credential could not be verified.", 401);
    if (error.code === "22023") return bad("Invalid location payload.");
    console.error("ingest_device_location failed", { code: error.code, message: error.message });
    return bad("Could not record location.", 500);
  }

  return NextResponse.json(
    { ok: true, event_id: data?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
