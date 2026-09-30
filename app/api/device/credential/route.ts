import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (!deviceId) {
    return NextResponse.json({ error: "device_id is required." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Device credential service is not configured." }, { status: 503 });
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: device } = await admin
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("owner_id", user.id)
    .single();

  if (!device) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("device_credentials").insert({
    device_id: deviceId,
    token_hash: hashToken(token),
  });

  if (error) {
    return NextResponse.json({ error: "Could not create device credential." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    device_id: deviceId,
    token,
    warning: "Store this token securely. It is shown only once.",
  });
}
