import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues (or rotates) the bearer credential for an enrolled device.
 * The plaintext token is returned once; only its SHA-256 hash is stored.
 * Any previously active credential for the device is revoked.
 */
export async function POST(request: Request) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { device_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isUuid(body.device_id)) {
    return NextResponse.json({ error: "A valid device_id is required." }, { status: 400 });
  }
  const deviceId = body.device_id;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Device credential service is not configured." }, { status: 503 });
  }

  const { data: device } = await admin
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!device) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  const token = randomBytes(32).toString("base64url");

  const { error: revokeError } = await admin
    .from("device_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .is("revoked_at", null);

  if (revokeError) {
    return NextResponse.json({ error: "Could not rotate device credential." }, { status: 500 });
  }

  const { error } = await admin.from("device_credentials").insert({
    device_id: deviceId,
    token_hash: hashToken(token),
  });

  if (error) {
    return NextResponse.json({ error: "Could not create device credential." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      device_id: deviceId,
      token,
      warning: "Store this token securely. It is shown only once.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
