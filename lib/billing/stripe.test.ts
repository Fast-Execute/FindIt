import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  isStaleSubscriptionUpdate,
  mapStripeStatus,
  normalizeSubscription,
  planFromPriceId,
  priceIdForPlan,
  siteUrl,
  verifyStripeSignature,
} from "./stripe.ts";

const SECRET = "whsec_test_secret";
const NOW = 1_800_000_000;
const BODY = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

function sign(body: string, timestamp: number, secret = SECRET) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW), true);
  });

  it("accepts when any one of several v1 signatures matches", () => {
    const header = `t=${NOW},v1=${"0".repeat(64)},v1=${sign(BODY, NOW)}`;
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW), true);
  });

  it("rejects a tampered body", () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    assert.equal(verifyStripeSignature(BODY.replace("evt_1", "evt_2"), header, SECRET, NOW), false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW, "whsec_other")}`;
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW), false);
  });

  it("rejects replays outside the tolerance window", () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW)}`;
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW + 301), false);
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW - 301), false);
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW + 300), true);
  });

  it("rejects a valid signature whose timestamp was altered", () => {
    const header = `t=${NOW + 1},v1=${sign(BODY, NOW)}`;
    assert.equal(verifyStripeSignature(BODY, header, SECRET, NOW), false);
  });

  it("rejects missing, malformed, or truncated headers", () => {
    assert.equal(verifyStripeSignature(BODY, null, SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, "", SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, "garbage", SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, `t=${NOW}`, SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, `t=abc,v1=${sign(BODY, NOW)}`, SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, `t=${NOW},v1=${sign(BODY, NOW).slice(0, 32)}`, SECRET, NOW), false);
    assert.equal(verifyStripeSignature(BODY, `t=${NOW},v1=not-hex`, SECRET, NOW), false);
  });

  it("rejects when no secret is configured", () => {
    const header = `t=${NOW},v1=${sign(BODY, NOW, "")}`;
    assert.equal(verifyStripeSignature(BODY, header, "", NOW), false);
  });
});

describe("mapStripeStatus", () => {
  it("maps Stripe statuses onto FindIt statuses", () => {
    assert.equal(mapStripeStatus("active"), "ACTIVE");
    assert.equal(mapStripeStatus("trialing"), "ACTIVE");
    assert.equal(mapStripeStatus("past_due"), "PAST_DUE");
    assert.equal(mapStripeStatus("unpaid"), "PAST_DUE");
    assert.equal(mapStripeStatus("canceled"), "CANCELED");
    assert.equal(mapStripeStatus("incomplete_expired"), "CANCELED");
    assert.equal(mapStripeStatus("incomplete"), "INACTIVE");
    assert.equal(mapStripeStatus("paused"), "INACTIVE");
    assert.equal(mapStripeStatus("something_new"), "INACTIVE");
  });
});

describe("plan and price mapping", () => {
  const env = { STRIPE_PRICE_PLUS: "price_plus", STRIPE_PRICE_FAMILY: " price_family " };

  it("resolves price ids both ways and ignores unconfigured plans", () => {
    assert.equal(priceIdForPlan("PLUS", env), "price_plus");
    assert.equal(priceIdForPlan("FAMILY", env), "price_family");
    assert.equal(priceIdForPlan("BASIC", env), null);
    assert.equal(planFromPriceId("price_plus", env), "PLUS");
    assert.equal(planFromPriceId("price_unknown", env), null);
    assert.equal(planFromPriceId(null, env), null);
  });
});

describe("normalizeSubscription", () => {
  const env = { STRIPE_PRICE_PLUS: "price_plus" };
  const ownerId = "5b0f8e0e-2c3b-4d7f-9a41-0c1d2e3f4a5b";

  it("reads the period end from items (newer API versions)", () => {
    const result = normalizeSubscription(
      {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { owner_id: ownerId },
        items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_plus" } }] },
      },
      env,
    );
    assert.equal(result.plan, "PLUS");
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.ownerId, ownerId);
    assert.equal(result.currentPeriodEnd, new Date(1_800_000_000 * 1000).toISOString());
  });

  it("falls back to the top-level period end and expanded customer objects", () => {
    const result = normalizeSubscription(
      { id: "sub_2", customer: { id: "cus_2" }, status: "past_due", current_period_end: 1_700_000_000, cancel_at_period_end: true },
      env,
    );
    assert.equal(result.customerId, "cus_2");
    assert.equal(result.currentPeriodEnd, new Date(1_700_000_000 * 1000).toISOString());
    assert.equal(result.cancelAtPeriodEnd, true);
    assert.equal(result.plan, null);
  });

  it("ignores an owner_id that is not a UUID", () => {
    const result = normalizeSubscription(
      { id: "sub_3", customer: "cus_3", status: "active", metadata: { owner_id: "'; drop table users; --" } },
      env,
    );
    assert.equal(result.ownerId, null);
  });
});

describe("isStaleSubscriptionUpdate", () => {
  it("ignores late death events for an old subscription when a newer one is live", () => {
    const existing = { provider_subscription_id: "sub_new", status: "ACTIVE" };
    assert.equal(isStaleSubscriptionUpdate(existing, { subscriptionId: "sub_old", status: "CANCELED" }), true);
  });

  it("accepts updates to the current subscription and to unrelated live ones", () => {
    const existing = { provider_subscription_id: "sub_new", status: "ACTIVE" };
    assert.equal(isStaleSubscriptionUpdate(existing, { subscriptionId: "sub_new", status: "CANCELED" }), false);
    assert.equal(isStaleSubscriptionUpdate(existing, { subscriptionId: "sub_other", status: "ACTIVE" }), false);
  });

  it("accepts a new subscription after the previous one ended, and a first subscription", () => {
    const ended = { provider_subscription_id: "sub_old", status: "CANCELED" };
    assert.equal(isStaleSubscriptionUpdate(ended, { subscriptionId: "sub_new", status: "ACTIVE" }), false);
    assert.equal(isStaleSubscriptionUpdate(null, { subscriptionId: "sub_new", status: "ACTIVE" }), false);
  });
});

describe("siteUrl", () => {
  const request = new Request("https://internal.example/api/billing/checkout");

  it("prefers configured NEXT_PUBLIC_SITE_URL and trims trailing slashes", () => {
    assert.equal(siteUrl(request, { NEXT_PUBLIC_SITE_URL: "https://findit.app/" }), "https://findit.app");
  });

  it("falls back to the request origin", () => {
    assert.equal(siteUrl(request, {}), "https://internal.example");
  });
});
