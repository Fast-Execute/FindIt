import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { planLabel, type PlanStatus } from "@/lib/plans";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: planRows } = await supabase.rpc("my_plan_status");
  const plan = ((planRows as PlanStatus[] | null) ?? [])[0];
  const name = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "Not set";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Settings</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Account & recovery settings.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Your account, plan, and what FindIt does with your devices&apos; data.</p>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <SettingsCard title="Account" items={[["Name", name], ["Email", user?.email ?? "—"]]} />
        <SettingsCard
          title="Plan"
          items={[
            ["Current plan", plan ? planLabel(plan.plan) : "—"],
            ["Manage billing", "/dashboard/billing"],
            ["Devices", plan ? `${plan.device_count} of ${plan.max_devices} used` : "—"],
            ["Reconnect alerts", plan?.reconnect_alerts ? "Included" : "Basic plan or higher"],
            ["Lost Mode", plan?.lost_mode ? "Included" : "Plus plan or higher"],
          ]}
        />
        <SettingsCard
          title="Privacy"
          items={[
            ["Location collection", "Only for devices you enroll"],
            ["Consent", "Required at enrollment"],
            ["Lost Mode", "Never bypasses device security"],
            ["Activity history", "Shown on each device page"],
          ]}
        />
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
            {value.startsWith("/") ? (
              <Link href={value} className="text-sm font-semibold text-[var(--accent)] hover:underline">Open billing</Link>
            ) : (
              <span className="break-all text-sm font-semibold">{value}</span>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
