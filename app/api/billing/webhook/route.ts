import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isStaleSubscriptionUpdate,
  isUuid,
  normalizeSubscription,
  stripeRequest,
  verifyStripeSignature,
  type StripeSubscription,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Which subscription (if any) an event is about. */
function subscriptionIdFor(event: StripeEvent): string | null {
  const object = event.data.object;

  if (SUBSCRIPTION_EVENTS.has(event.type)) return asString(object.id);

  if (event.type === "checkout.session.completed") {
    return object.mode === "subscription" ? asString(object.subscription) : null;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    // Newer API versions nest it under parent.subscription_details; older ones expose `subscription`.
    const parent = object.parent as { subscription_details?: { subscription?: unknown } } | undefined;
    return asString(parent?.subscription_details?.subscription) ?? asString(object.subscription);
  }

  return null;
}

async function syncSubscription(admin: AdminClient, stripeKey: string, event: StripeEvent) {
  const subscriptionId = subscriptionIdFor(event);
  if (!subscriptionId) return;

  // Re-fetch instead of trusting the payload: events can arrive out of order, and the
  // current Stripe state is the source of truth.
  const stripeSubscription = await stripeRequest<StripeSubscription>(
    stripeKey,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  const subscription = normalizeSubscription(stripeSubscription);

  let ownerId = subscription.ownerId;
  if (!ownerId && event.type === "checkout.session.completed") {
    const reference = event.data.object.client_reference_id;
    ownerId = isUuid(reference) ? reference : null;
  }
  if (!ownerId) {
    const { data } = await admin
      .from("subscriptions")
      .select("owner_id")
      .eq("provider_customer_id", subscription.customerId)
      .maybeSingle();
    ownerId = data?.owner_id ?? null;
  }
  if (!ownerId) {
    // Not one of ours (for example a different product on the same Stripe account).
    console.warn("billing webhook: no owner for subscription", subscription.subscriptionId);
    return;
  }

  const { data: existing, error: readError } = await admin
    .from("subscriptions")
    .select("provider_subscription_id, status")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (readError) throw new Error(`read subscription failed: ${readError.message}`);

  if (isStaleSubscriptionUpdate(existing, subscription)) return;

  if (subscription.priceId && !subscription.plan) {
    console.warn("billing webhook: price id does not match any STRIPE_PRICE_* plan", subscription.priceId);
  }

  const { error: writeError } = await admin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      provider: "stripe",
      provider_customer_id: subscription.customerId,
      provider_subscription_id: subscription.subscriptionId,
      status: subscription.status,
      price_id: subscription.priceId,
      current_period_end: subscription.currentPeriodEnd,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      ...(subscription.plan ? { plan: subscription.plan } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (writeError) throw new Error(`write subscription failed: ${writeError.message}`);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminClient();
  if (!webhookSecret || !stripeKey || !admin) {
    return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
  }

  // Signature verification needs the exact bytes Stripe sent, so read the body as text.
  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (!event?.id || !event.type || typeof event.data?.object !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Idempotency: Stripe retries and may deliver an event more than once.
  const { error: claimError } = await admin.from("billing_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("billing webhook: could not record event", claimError.message);
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  try {
    await syncSubscription(admin, stripeKey, event);
  } catch (error) {
    // Release the claim so Stripe's retry can process this event again.
    await admin.from("billing_events").delete().eq("id", event.id);
    console.error("billing webhook: processing failed", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
