import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiHeaders, getPayfastConfig } from "@/lib/payfast";

// Cancels the signed-in user's PayFast subscription. They keep access until the end
// of the period they have already paid for.
export async function POST() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const config = getPayfastConfig(process.env);
  const admin = createAdminClient();
  if (!config || !admin) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("payfast_token,status,current_period_end")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!subscription?.payfast_token || !["ACTIVE", "PAST_DUE"].includes(subscription.status)) {
    return NextResponse.json({ error: "There is no active subscription to cancel." }, { status: 409 });
  }

  const url =
    `${config.apiBase}/subscriptions/${encodeURIComponent(subscription.payfast_token)}/cancel` +
    (config.sandbox ? "?testing=true" : "");

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: apiHeaders(config),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || (result?.status && result.status !== "success")) {
      console.error(`[payfast-cancel] PayFast answered ${response.status}`);
      return NextResponse.json(
        { error: "PayFast could not cancel the subscription. You can also cancel from the link in your PayFast receipt email." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Could not reach PayFast. Please try again." }, { status: 502 });
  }

  await admin.rpc("mark_subscription_canceled", { p_owner_id: user.id });
  return NextResponse.json({ ok: true, access_until: subscription.current_period_end });
}
