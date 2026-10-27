import { NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl, stripeRequest } from "@/lib/billing/stripe";

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

  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Could not load your subscription." }, { status: 500 });
  }
  if (!subscription?.provider_customer_id) {
    return NextResponse.json({ error: "No billing account yet. Choose a plan first." }, { status: 404 });
  }

  try {
    const session = await stripeRequest<{ url: string }>(stripeKey, "POST", "/billing_portal/sessions", {
      customer: subscription.provider_customer_id,
      return_url: `${siteUrl(request)}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (portalError) {
    console.error("billing portal failed", portalError instanceof Error ? portalError.message : portalError);
    return NextResponse.json({ error: "Could not open billing." }, { status: 502 });
  }
}
