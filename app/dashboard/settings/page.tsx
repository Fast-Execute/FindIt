import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS, describeSubscription, formatDateTime, getAccountSummary } from "@/lib/account";

export default async function SettingsPage() {
  const supabase = await createClient();
  const account = await getAccountSummary(supabase);
  if (!account) notFound();

  const plan = describeSubscription(account.subscription);
  const active = account.subscription?.status === "ACTIVE";
  const limit = active && account.subscription ? PLANS[account.subscription.plan].deviceLimit : null;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Settings</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Account & recovery settings.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Your account details and plan. Editing profile details and billing will arrive in later updates.</p>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <SettingsCard title="Account" items={[
          ["Name", account.name || "Not set"],
          ["Email", account.email || "Not available"],
        ]} />
        <SettingsCard title="Subscription" items={[
          ["Plan", plan.headline],
          ["Status", plan.badge === "NONE" ? "No subscription" : plan.badge],
          ["Billing", plan.detail],
          ["Renews / ends", formatDateTime(account.subscription?.current_period_end ?? null, "—")],
          ["Devices", limit === null ? `${account.deviceCount} enrolled` : `${account.deviceCount} of ${limit} used`],
        ]} />
        <SettingsCard title="Recovery alerts" items={[
          ["Reconnect alerts", "Not available yet"],
          ["Lost Mode", "Not available yet"],
          ["Location updates", "Authorized enrolled devices only"],
        ]} />
        <SettingsCard title="Privacy" items={[
          ["Location collection", "Only for devices you enroll"],
          ["Consent", "Required at enrollment"],
          ["Audit history", "Planned"],
        ]} />
      </section>
    </div>
  );
}

function SettingsCard({ title, items }: { title: string; items: string[][] }) {
  return (
    <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5 divide-y divide-[var(--line)]">
        {items.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <span className="break-all text-sm font-semibold sm:text-right">{value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
