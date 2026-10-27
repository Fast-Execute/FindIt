import { createClient } from "@/lib/supabase/server";
import { availablePlans } from "@/lib/billing/stripe";
import BillingActions from "./billing-actions";

type SearchParams = Promise<{ billing?: string | string[] }>;

const PLAN_LABELS: Record<string, string> = { BASIC: "Basic", PLUS: "Plus", FAMILY: "Family" };
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PAST_DUE: "Payment past due",
  CANCELED: "Canceled",
  INACTIVE: "No active subscription",
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB",{ year: "numeric", month: "long", day: "numeric" });
}

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { billing } = await searchParams;
  const billingResult = Array.isArray(billing) ? billing[0] : billing;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = user
    ? await supabase
        .from("subscriptions")
        .select("plan, status, provider_customer_id, current_period_end, cancel_at_period_end")
        .eq("owner_id", user.id)
        .maybeSingle()
    : { data: null };

  const status = subscription?.status ?? "INACTIVE";
  const isLive = status === "ACTIVE" || status === "PAST_DUE";
  const renews = formatDate(subscription?.current_period_end ?? null);

  const subscriptionItems: string[][] = [
    ["Plan", isLive ? (PLAN_LABELS[subscription?.plan ?? ""] ?? subscription?.plan ?? "—") : "None"],
    ["Status", STATUS_LABELS[status] ?? status],
  ];
  if (isLive && renews) {
    subscriptionItems.push([subscription?.cancel_at_period_end ? "Ends on" : "Renews on", renews]);
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Settings</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Account & recovery settings.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
          Account and subscription details are live. Recovery alert and privacy controls are still placeholders until
          device services are connected.
        </p>
      </section>

      {billingResult === "success" && (
        <div role="status" className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-4 text-sm">
          Thanks! Your payment went through. Your subscription status can take a few seconds to update — refresh if it
          still shows no plan.
        </div>
      )}
      {billingResult === "canceled" && (
        <div role="status" className="rounded-2xl border border-[var(--line)] px-5 py-4 text-sm text-[var(--muted)]">
          Checkout was canceled. You have not been charged.
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <SettingsCard title="Account" items={[["Email", user?.email ?? "—"], ["Session", "Signed in"]]} />
        <SettingsCard title="Subscription" items={subscriptionItems}>
          {status === "PAST_DUE" && (
            <p className="mt-4 text-xs leading-5 text-yellow-300">
              Your last payment failed. Open Manage billing to update your payment method.
            </p>
          )}
          <BillingActions
            plans={availablePlans()}
            hasBillingAccount={Boolean(subscription?.provider_customer_id)}
            hasLiveSubscription={isLive}
          />
        </SettingsCard>
        <SettingsCard
          title="Recovery alerts"
          items={[
            ["Device reconnect", "Enabled in demo"],
            ["Location updates", "Authorized device only"],
            ["Lost Mode", "Ready for integration"],
          ]}
        />
        <SettingsCard
          title="Privacy"
          items={[
            ["Location collection", "Only for enrolled devices"],
            ["Consent", "Required"],
            ["Audit history", "Planned"],
          ]}
        />
      </section>
    </div>
  );
}

function SettingsCard({
  title,
  items,
  children,
}: {
  title: string;
  items: string[][];
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5 divide-y divide-[var(--line)]">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
          >
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <span className="text-sm font-semibold">{value}</span>
          </div>
        ))}
      </div>
      {children}
    </article>
  );
}
