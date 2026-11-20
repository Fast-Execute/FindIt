import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function authorize(request: Request) {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  let body: { device_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (!deviceId) {
    return { error: NextResponse.json({ error: "device_id is required." }, { status: 400 }) };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return { error: NextResponse.json({ error: "Device credential service is not configured." }, { status: 503 }) };
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user, deviceId, admin };
}

// Issue a new device token. Any previously active token for the device is revoked,
// so calling this again is how a token is rotated.
export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  const { user, deviceId, admin } = auth;

  const token = randomBytes(32).toString("base64url");
  const { data: expiresAt, error } = await admin.rpc("rotate_device_credential", {
    p_device_id: deviceId,
    p_owner_id: user.id,
    p_token_hash: hashToken(token),
  });

  if (error) {
    if (error.message?.includes("Device not found")) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not create device credential." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    device_id: deviceId,
    token,
    expires_at: expiresAt,
    warning: "Store this token securely. It is shown only once. Any previous token for this device no longer works.",
  });
}

// Revoke all active tokens for a device (for example, when it is lost or retired).
export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  const { user, deviceId, admin } = auth;

  const { data: revoked, error } = await admin.rpc("revoke_device_credentials", {
    p_device_id: deviceId,
    p_owner_id: user.id,
  });

  if (error) {
    if (error.message?.includes("Device not found")) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not revoke device credentials." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, device_id: deviceId, revoked });
}
