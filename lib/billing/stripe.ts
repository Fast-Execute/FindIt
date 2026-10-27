import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal, dependency-free Stripe helpers: signed-webhook verification,
// a small REST client, and mapping from Stripe objects to FindIt's schema.

export const PLANS = ["BASIC", "PLUS", "FAMILY"] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["INACTIVE", "ACTIVE", "PAST_DUE", "CANCELED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const STRIPE_API_BASE = "https://api.stripe.com/v1";
export const SIGNATURE_TOLERANCE_SECONDS = 300;

type Env = Record<string, string | undefined>;

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/** Stripe price id configured for a plan (STRIPE_PRICE_BASIC / _PLUS / _FAMILY). */
export function priceIdForPlan(plan: Plan, env: Env = process.env): string | null {
  const value = env[`STRIPE_PRICE_${plan}`]?.trim();
  return value ? value : null;
}

/** Reverse lookup used when syncing a subscription back into our plan column. */
export function planFromPriceId(priceId: string | null | undefined, env: Env = process.env): Plan | null {
  if (!priceId) return null;
  return PLANS.find((plan) => priceIdForPlan(plan, env) === priceId) ?? null;
}

export function availablePlans(env: Env = process.env): Plan[] {
  return PLANS.filter((plan) => priceIdForPlan(plan, env) !== null);
}

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      // incomplete, paused, or anything Stripe adds later: not entitled.
      return "INACTIVE";
  }
}

/**
 * Verifies a Stripe-Signature header against the raw request body.
 * Header format: `t=<unix>,v1=<hex hmac>[,v1=<hex hmac>...]` where the HMAC is
 * SHA-256 over `${t}.${rawBody}` keyed with the endpoint's signing secret.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (!header || !secret) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();

  return signatures.some((candidate) => {
    if (!/^[0-9a-f]+$/i.test(candidate) || candidate.length !== expected.length * 2) return false;
    return timingSafeEqual(Buffer.from(candidate, "hex"), expected);
  });
}

export class StripeApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
  }
}

type StripeParams = Record<string, string | number | boolean | undefined>;

/** Calls the Stripe REST API. Params use Stripe's bracket syntax, e.g. `line_items[0][price]`. */
export async function stripeRequest<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params: StripeParams = {},
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.append(key, String(value));
  }

  const encoded = body.toString();
  const query = method === "GET" && encoded ? `?${encoded}` : "";
  const response = await fetch(`${STRIPE_API_BASE}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? encoded : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  const json = (await response.json().catch(() => null)) as
    | { error?: { message?: string; code?: string } }
    | null;

  if (!response.ok) {
    throw new StripeApiError(
      json?.error?.message ?? `Stripe request failed (${response.status})`,
      response.status,
      json?.error?.code,
    );
  }

  return json as T;
}

export type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  // Older API versions expose the period on the subscription, newer ones on its items.
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ current_period_end?: number; price?: { id?: string } }> };
};

export type NormalizedSubscription = {
  subscriptionId: string;
  customerId: string;
  status: SubscriptionStatus;
  priceId: string | null;
  plan: Plan | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  ownerId: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function normalizeSubscription(sub: StripeSubscription, env: Env = process.env): NormalizedSubscription {
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const priceId = item?.price?.id ?? null;
  const metadataOwner = sub.metadata?.owner_id;

  return {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: mapStripeStatus(sub.status),
    priceId,
    plan: planFromPriceId(priceId, env),
    currentPeriodEnd: typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    ownerId: isUuid(metadataOwner) ? metadataOwner : null,
  };
}

/**
 * A late event about an old, ended subscription must not overwrite the state of a
 * newer active one. True when the incoming subscription should be ignored.
 */
export function isStaleSubscriptionUpdate(
  existing: { provider_subscription_id: string | null; status: string } | null,
  incoming: Pick<NormalizedSubscription, "subscriptionId" | "status">,
): boolean {
  if (!existing?.provider_subscription_id) return false;
  if (existing.provider_subscription_id === incoming.subscriptionId) return false;
  const existingIsLive = existing.status === "ACTIVE" || existing.status === "PAST_DUE";
  const incomingIsDead = incoming.status === "CANCELED" || incoming.status === "INACTIVE";
  return existingIsLive && incomingIsDead;
}

/** Base URL for Stripe return links. Prefer explicit config over the request's Host header. */
export function siteUrl(request: Request, env: Env = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}
