import { NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlan, priceIdForPlan, siteUrl, stripeRequest } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminClient();
  if (!stripeKey || !admin) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const userClient = await createUserClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isPlan(body.plan)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const priceId = priceIdForPlan(body.plan);
  if (!priceId) {
    return NextResponse.json({ error: "That plan is not available yet." }, { status: 503 });
  }

  const { data: existing, error: readError } = await admin
    .from("subscriptions")
    .select("provider_customer_id, status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Could not load your subscription." }, { status: 500 });
  }

  // Never start a second subscription: changes and payment fixes go through the portal.
  if (existing?.status === "ACTIVE" || existing?.status === "PAST_DUE") {
    return NextResponse.json(
      { error: "You already have a subscription. Use Manage billing to change it." },
      { status: 409 },
    );
  }

  try {
    let customerId = existing?.provider_customer_id ?? null;
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>(stripeKey, "POST", "/customers", {
        email: user.email,
        "metadata[owner_id]": user.id,
      });
      customerId = customer.id;

      const { error: saveError } = await admin
        .from("subscriptions")
        .upsert(
          { owner_id: user.id, provider: "stripe", provider_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: "owner_id" },
        );
      if (saveError) {
        return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
      }
    }

    const base = siteUrl(request);
    const session = await stripeRequest<{ url: string | null }>(stripeKey, "POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      // owner_id on the subscription lets webhooks map every later event back to this user.
      "subscription_data[metadata][owner_id]": user.id,
      allow_promotion_codes: true,
      success_url: `${base}/dashboard/settings?billing=success`,
      cancel_url: `${base}/dashboard/settings?billing=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("billing checkout failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
