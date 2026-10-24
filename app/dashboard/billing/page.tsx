import { createClient } from "@/lib/supabase/server";
import { formatDateTime, planLabel, type PlanStatus } from "@/lib/plans";
import { PAID_PLANS, PLAN_CATALOG, PLAN_PRICES_ZAR, formatZar } from "@/lib/pricing";
import { CancelButton, SubscribeButton } from "./billing-actions";

type Payment = {
  id: number;
  pf_payment_id: string;
  payment_status: string;
  amount_gross: number | null;
  created_at: string;
};

const PAYMENT_STYLES: Record<string, string> = {
  COMPLETE: "text-[var(--accent)]",
  FAILED: "text-red-300",
  CANCELLED: "text-yellow-300",
  PENDING: "text-[var(--muted)]",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const supabase = await createClient();

  const [{ data: planRows }, { data: paymentRows }] = await Promise.all([
    supabase.rpc("my_plan_status"),
    supabase
      .from("billing_payments")
      .select("id,pf_payment_id,payment_status,amount_gross,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const plan = ((planRows as PlanStatus[] | null) ?? [])[0];
  const payments = (paymentRows as Payment[] | null) ?? [];
  const status = plan?.subscription_status ?? "NONE";
  const hasActive = status === "ACTIVE" || status === "PAST_DUE";
  const canceledWithAccess = status === "CANCELED" && plan?.plan !== "FREE";
  const periodEnd = plan?.current_period_end ? formatDateTime(plan.current_period_end) : null;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Billing</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Your plan.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Billed monthly in rand through PayFast. Cancel any time and keep access until the end of the month you paid for.</p>
      </section>

      {checkout === "success" && (
        <section className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-5 py-4 text-sm">
          Thanks. PayFast is confirming your payment, which usually takes under a minute. Refresh this page if your plan has not updated yet.
        </section>
      )}
      {checkout === "cancelled" && (
        <section className="rounded-2xl border border-[var(--line)] bg-white/[.03] px-5 py-4 text-sm text-[var(--muted)]">
          Checkout was cancelled. You have not been charged.
        </section>
      )}
      {status === "PAST_DUE" && (
        <section className="rounded-2xl border border-red-400/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
          Your last payment failed. PayFast will retry; update your card from the link in your PayFast receipt email to avoid losing access.
        </section>
      )}

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-[var(--muted)]">Current plan</div>
            <div className="mt-1 text-3xl font-black">{plan ? planLabel(plan.plan) : "—"}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              {hasActive && periodEnd && `Paid through ${periodEnd}. Renews automatically.`}
              {canceledWithAccess && periodEnd && `Cancelled. You keep access until ${periodEnd}.`}
              {!hasActive && !canceledWithAccess && "No active subscription."}
            </div>
          </div>
          {hasActive && <CancelButton accessUntil={periodEnd} />}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-black">{hasActive ? "Plans" : "Choose a plan"}</h2>
        {hasActive && <p className="mt-1 text-sm text-[var(--muted)]">To switch plans, cancel your current subscription first, then choose a new one.</p>}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {PAID_PLANS.map((key) => {
            const info = PLAN_CATALOG[key];
            const isCurrent = hasActive && plan?.plan === key;
            return (
              <article key={key} className={`rounded-3xl border p-7 ${info.featured ? "border-[var(--accent)] bg-[var(--panel)]" : "border-[var(--line)] bg-[var(--panel)]/50"}`}>
                {info.featured && <div className="mb-5 text-xs font-bold uppercase tracking-[.15em] text-[var(--accent)]">Most flexible</div>}
                <h3 className="text-2xl font-bold">{info.name}</h3>
                <div className="mt-5 text-4xl font-black">{formatZar(PLAN_PRICES_ZAR[key])}<span className="text-base font-normal text-[var(--muted)]"> / month</span></div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--muted)]">{info.description}</p>
                <ul className="mt-7 space-y-3 text-sm">
                  {info.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-[var(--accent)]">✓</span>{feature}</li>)}
                </ul>
                {isCurrent ? (
                  <div className="mt-8 rounded-full border border-[var(--accent)]/40 px-5 py-3 text-center text-sm font-bold text-[var(--accent)]">Your current plan</div>
                ) : (
                  <SubscribeButton plan={key} label={`Choose ${info.name}`} disabled={hasActive} featured={info.featured} />
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h2 className="text-xl font-black">Payment history</h2>
        {payments.length > 0 ? (
          <div className="mt-4 divide-y divide-[var(--line)]">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold">{payment.amount_gross == null ? "—" : formatZar(Number(payment.amount_gross))}</span>
                <span className={`text-xs font-bold ${PAYMENT_STYLES[payment.payment_status] ?? ""}`}>{payment.payment_status}</span>
                <span className="text-xs text-[var(--muted)]">{formatDateTime(payment.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">No payments yet.</p>
        )}
      </section>
    </div>
  );
}
