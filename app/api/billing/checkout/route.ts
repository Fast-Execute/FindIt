import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCheckout, getPayfastConfig } from "@/lib/payfast";
import { PLAN_CATALOG, PLAN_PRICES_ZAR, isPaidPlan } from "@/lib/pricing";

// Starts a PayFast subscription checkout. The plan comes from the client, but the
// amount is always taken from our own price table, never from the request.
export async function POST(request: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isPaidPlan(body.plan)) {
    return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }

  const config = getPayfastConfig(process.env);
  const admin = createAdminClient();
  if (!config || !admin) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const amountZar = PLAN_PRICES_ZAR[body.plan];
  const { data: checkoutId, error } = await admin.rpc("begin_checkout", {
    p_owner_id: user.id,
    p_plan: body.plan,
    p_amount_zar: amountZar,
  });

  if (error || !checkoutId) {
    const message = error?.message ?? "";
    if (message.startsWith("SUBSCRIPTION_ACTIVE")) {
      return NextResponse.json({ error: message.replace(/^SUBSCRIPTION_ACTIVE:\s*/, "") }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const checkout = buildCheckout(config, {
    checkoutId: String(checkoutId),
    plan: body.plan,
    planLabel: PLAN_CATALOG[body.plan].name,
    amountZar,
    email: user.email ?? "",
    firstName: fullName.trim().split(/\s+/)[0] ?? "",
  });

  return NextResponse.json({ ok: true, ...checkout });
}
