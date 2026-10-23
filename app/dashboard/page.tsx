import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, planLabel, type DeviceAlert, type PlanStatus } from "@/lib/plans";

type DeviceRow = {
  id: string;
  name: string;
  model: string | null;
  status: string;
  battery_pct: number | null;
  last_seen_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_accuracy_m: number | null;
  lost_mode: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  ONLINE: "bg-[var(--accent)]/10 text-[var(--accent)]",
  OFFLINE: "bg-yellow-400/10 text-yellow-300",
  POWERED_OFF: "bg-yellow-400/10 text-yellow-300",
  UNREACHABLE: "bg-yellow-400/10 text-yellow-300",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: deviceRows }, { data: alertRows }, { data: planRows }] = user
    ? await Promise.all([
        supabase
          .from("devices")
          .select("id,name,model,status,battery_pct,last_seen_at,last_latitude,last_longitude,last_location_accuracy_m,lost_mode")
          .eq("owner_id", user.id)
          .order("last_seen_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("device_alerts")
          .select("id,device_id,kind,message,created_at,read_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.rpc("my_plan_status"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const devices = (deviceRows as DeviceRow[] | null) ?? [];
  const alerts = (alertRows as DeviceAlert[] | null) ?? [];
  const plan = ((planRows as PlanStatus[] | null) ?? [])[0];
  const primary = devices[0];
  const lostCount = devices.filter((device) => device.lost_mode).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Overview</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Your recovery dashboard.</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">See the most recent verified state of every enrolled device. FindIt never presents an old location as live.</p>
        </div>
        <Link href="/dashboard/devices/enroll" className="rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-bold text-[#06100b] hover:brightness-110">+ Add device</Link>
      </section>

      {lostCount > 0 && (
        <section className="rounded-2xl border border-red-400/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
          Lost Mode is on for {lostCount} {lostCount === 1 ? "device" : "devices"}. You will be alerted when {lostCount === 1 ? "it reconnects" : "they reconnect"}.
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.5fr_.7fr]">
        {primary ? (
          <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{primary.model}</div>
                <h2 className="mt-1 text-2xl font-black">{primary.name}</h2>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${STATUS_STYLES[primary.status] ?? STATUS_STYLES.OFFLINE}`}>{primary.status}</span>
            </div>
            <div className="grid gap-5 py-6 sm:grid-cols-3">
              <Metric label="Last seen" value={formatDateTime(primary.last_seen_at)} />
              <Metric label="Battery" value={primary.battery_pct == null ? "—" : primary.battery_pct + "%"} />
              <Metric label="Accuracy" value={primary.last_location_accuracy_m == null ? "—" : `±${Math.round(primary.last_location_accuracy_m)} m`} />
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-5">
              <div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Last known location</div>
              <div className="mt-2 text-lg font-bold">
                {primary.last_latitude == null || primary.last_longitude == null
                  ? "No location reported yet"
                  : `${primary.last_latitude.toFixed(5)}, ${primary.last_longitude.toFixed(5)}`}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">Recorded {formatDateTime(primary.last_seen_at)}</div>
            </div>
            <Link href={`/dashboard/devices/${primary.id}`} className="mt-5 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-black">Open device and recovery controls</Link>
          </article>
        ) : (
          <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/[.02] p-8 text-center">
            <h2 className="text-xl font-black">No devices enrolled yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Enroll a device you own to start seeing its last known state here.</p>
            <Link href="/dashboard/devices/enroll" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[#06100b]">Enroll your first device</Link>
          </article>
        )}

        <aside className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Your plan</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="text-2xl font-black">{plan ? planLabel(plan.plan) : "—"}</div>
              {plan && plan.plan !== "FREE" && <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--accent)]">{plan.subscription_status}</span>}
            </div>
            {plan && (
              <>
                <div className="mt-5 h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (plan.device_count / plan.max_devices) * 100)}%` }} /></div>
                <div className="mt-2 text-xs text-[var(--muted)]">{plan.device_count} of {plan.max_devices} device {plan.max_devices === 1 ? "slot" : "slots"} used</div>
                {(!plan.lost_mode || !plan.reconnect_alerts) && (
                  <Link href="/#pricing" className="mt-5 block rounded-2xl border border-[var(--accent)]/40 px-4 py-3 text-center text-sm font-bold text-[var(--accent)] hover:bg-[var(--accent)]/5">
                    {plan.reconnect_alerts ? "Upgrade for Lost Mode" : "Upgrade for reconnect alerts"}
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Your devices</div>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {devices.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing enrolled yet.</p>}
              {devices.map((device) => (
                <Link key={device.id} href={`/dashboard/devices/${device.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[var(--accent)]">
                  <span className="font-semibold">{device.name}{device.lost_mode ? " · Lost" : ""}</span>
                  <span className="text-xs text-[var(--muted)]">{device.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Recent recovery events</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Alerts and Lost Mode changes across your devices.</p>
          </div>
        </div>
        {alerts.length > 0 ? (
          <div className="mt-6 divide-y divide-[var(--line)]">
            {alerts.map((alert) => (
              <div key={alert.id} className="grid gap-2 py-4 sm:grid-cols-[170px_1fr] sm:items-center">
                <div className="text-sm font-bold text-[var(--accent)]">{formatDateTime(alert.created_at)}</div>
                <div className="font-semibold">{alert.message ?? alert.kind}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--muted)]">No events yet. Turn on reconnect alerts or Lost Mode from a device page.</p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">{label}</div><div className="mt-2 text-xl font-black">{value}</div></div>;
}
