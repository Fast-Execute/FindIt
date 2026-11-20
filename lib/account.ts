import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "BASIC" | "PLUS" | "FAMILY";
export type SubscriptionStatus = "INACTIVE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

// Mirrors the plans advertised on the landing page (app/page.tsx).
export const PLANS: Record<PlanId, { label: string; price: string; deviceLimit: number }> = {
  BASIC: { label: "Basic", price: "$4.99", deviceLimit: 1 },
  PLUS: { label: "Plus", price: "$9.99", deviceLimit: 3 },
  FAMILY: { label: "Family", price: "$14.99", deviceLimit: 10 },
};

export type Subscription = {
  plan: PlanId;
  status: SubscriptionStatus;
  current_period_end: string | null;
};

export type AccountSummary = {
  userId: string;
  email: string;
  name: string;
  subscription: Subscription | null;
  deviceCount: number;
};

// Billing is not connected yet, so most accounts have no subscription row.
// Callers must handle `subscription === null` ("no active plan").
export async function getAccountSummary(supabase: SupabaseClient): Promise<AccountSummary | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: subscription }, { count }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase.from("devices").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);

  const metadata = (user.user_metadata ?? {}) as { full_name?: unknown };
  const name = typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name.trim() : "";

  return {
    userId: user.id,
    email: user.email ?? "",
    name,
    subscription: (subscription as Subscription | null) ?? null,
    deviceCount: count ?? 0,
  };
}

export function describeSubscription(subscription: Subscription | null) {
  if (!subscription || subscription.status === "INACTIVE") {
    return { headline: "No active plan", detail: "Billing is not set up yet", badge: "NONE" as const };
  }
  const plan = PLANS[subscription.plan];
  const badge = subscription.status;
  const detail =
    subscription.status === "ACTIVE" ? `${plan.price} / month`
    : subscription.status === "PAST_DUE" ? "Payment overdue"
    : "Canceled";
  return { headline: plan.label, detail, badge };
}

export function formatDateTime(value: string | null, fallback = "Not reported") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
