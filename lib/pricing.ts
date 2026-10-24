// Single source of truth for what we charge. The server reads prices from here
// when creating a checkout; the client never supplies an amount.
// Change a price here and it changes on the pricing page, the billing page and the charge.

export const PAID_PLANS = ["BASIC", "PLUS", "FAMILY"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const PLAN_PRICES_ZAR: Record<PaidPlan, number> = {
  BASIC: 89,
  PLUS: 179,
  FAMILY: 269,
};

export const PLAN_CATALOG: Record<
  PaidPlan,
  { name: string; description: string; features: string[]; featured?: boolean }
> = {
  BASIC: {
    name: "Basic",
    description: "For protecting one personal device.",
    features: ["1 enrolled device", "Last-known location", "Reconnect alerts"],
  },
  PLUS: {
    name: "Plus",
    description: "For people with more than one device to protect.",
    features: ["Up to 3 devices", "Lost Mode", "Reconnect alerts", "Everything in Basic"],
    featured: true,
  },
  FAMILY: {
    name: "Family",
    description: "For managing authorized family devices.",
    features: ["Up to 10 devices", "Lost Mode", "Shared management", "Recovery alerts"],
  },
};

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && (PAID_PLANS as readonly string[]).includes(value);
}

export function formatZar(amount: number) {
  return `R${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}
