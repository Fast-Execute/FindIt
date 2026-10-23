import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/devices";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: subscription } = user
    ? await supabase.from("subscriptions").select("plan,status,current_period_end").eq("owner_id", user.id).maybeSingle()
    : { data: null };

  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "—";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Settings</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Account & recovery settings.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Your account details. Editing, billing and alert controls are planned.</p>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <SettingsCard title="Account" items={[["Name", fullName], ["Email", user?.email ?? "—"], ["Member since", formatDate(user?.created_at)]]} />
        <SettingsCard
          title="Subscription"
          items={
            subscription
              ? [["Plan", subscription.plan], ["Status", subscription.status], ["Renews", formatDate(subscription.current_period_end)]]
              : [["Plan", "None"], ["Billing", "Not enabled yet"]]
          }
        />
        <SettingsCard title="Recovery alerts" items={[["Device reconnect alerts", "Planned"], ["Lost Mode", "Planned"]]} />
        <SettingsCard title="Privacy" items={[["Location collection", "Only for enrolled devices"], ["Consent", "Required at enrollment"], ["Audit history", "Planned"]]} />
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
            <span className="break-all text-sm font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
