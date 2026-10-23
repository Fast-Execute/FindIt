import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, timeAgo } from "@/lib/devices";
import StatusBadge from "./status-badge";

type Device = {
  id: string;
  name: string;
  model: string | null;
  status: string;
  battery_pct: number | null;
  last_seen_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_accuracy_m: number | null;
};

type LocationEvent = {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  recorded_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [devicesResult, eventsResult, subscriptionResult] = user
    ? await Promise.all([
        supabase
          .from("devices")
          .select("id,name,model,status,battery_pct,last_seen_at,last_latitude,last_longitude,last_location_accuracy_m")
          .eq("owner_id", user.id)
          .order("last_seen_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("location_events")
          .select("id,device_id,latitude,longitude,accuracy_m,recorded_at")
          .eq("owner_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(5),
        supabase.from("subscriptions").select("plan,status,current_period_end").eq("owner_id", user.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }];

  const devices = (devicesResult.data ?? []) as Device[];
  const events = (eventsResult.data ?? []) as LocationEvent[];
  const subscription = subscriptionResult.data as { plan: string; status: string; current_period_end: string | null } | null;
  const primary = devices[0];
  const deviceNames = new Map(devices.map((d) => [d.id, d.name]));

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

      <section className="grid gap-5 lg:grid-cols-[1.5fr_.7fr]">
        {primary ? (
          <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{primary.model}</div>
                <h2 className="mt-1 text-2xl font-black">{primary.name}</h2>
              </div>
              <StatusBadge status={primary.status} />
            </div>
            <div className="grid gap-5 py-6 sm:grid-cols-3">
              <Metric label="Last seen" value={timeAgo(primary.last_seen_at)} note={formatDate(primary.last_seen_at)} />
              <Metric label="Battery" value={primary.battery_pct == null ? "—" : `${primary.battery_pct}%`} note="Last reported" />
              <Metric label="Devices" value={String(devices.length)} note="Enrolled" />
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-5">
              <div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Last known location</div>
              {primary.last_latitude == null || primary.last_longitude == null ? (
                <div className="mt-2 text-lg font-bold">No location reported yet</div>
              ) : (
                <>
                  <div className="mt-2 font-mono text-lg font-bold">{primary.last_latitude.toFixed(5)}, {primary.last_longitude.toFixed(5)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Recorded {timeAgo(primary.last_seen_at)}
                    {primary.last_location_accuracy_m == null ? "" : ` · accuracy ±${Math.round(primary.last_location_accuracy_m)} m`}
                    {primary.status === "ONLINE" ? "" : " · not a live position"}
                  </div>
                </>
              )}
            </div>
            <Link href={`/dashboard/devices/${primary.id}`} className="mt-5 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-black">Open device</Link>
          </article>
        ) : (
          <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/[.02] p-8 text-center">
            <h2 className="text-xl font-black">No devices enrolled yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Enroll a device you own to start seeing its status and last known location here.</p>
            <Link href="/dashboard/devices/enroll" className="mt-5 inline-flex rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-bold">Start enrollment</Link>
          </article>
        )}

        <aside className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Subscription</div>
            {subscription ? (
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <div className="text-2xl font-black capitalize">{subscription.plan.toLowerCase()}</div>
                  {subscription.current_period_end && <div className="mt-1 text-xs text-[var(--muted)]">Renews {formatDate(subscription.current_period_end)}</div>}
                </div>
                <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--accent)]">{subscription.status}</span>
              </div>
            ) : (
              <div className="mt-2 text-sm leading-6 text-[var(--muted)]">No subscription yet. Billing is not enabled in this build.</div>
            )}
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Recovery actions</div>
            <div className="mt-4 grid gap-3">
              <button disabled className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold opacity-50">Enable Lost Mode</button>
              <button disabled className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold opacity-50">Alert me when online</button>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Lost Mode and reconnect alerts are coming soon.</p>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h2 className="text-xl font-black">Recent location events</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Authorized records reported by your enrolled devices.</p>
        {events.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">No events yet. They appear once a connected device reports in.</p>
        ) : (
          <div className="mt-6 divide-y divide-[var(--line)]">
            {events.map((event) => (
              <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[140px_1fr_auto] sm:items-center">
                <div className="text-sm font-bold text-[var(--accent)]">{timeAgo(event.recorded_at)}</div>
                <div>
                  <div className="font-semibold">{deviceNames.get(event.device_id) ?? "Device"}</div>
                  <div className="font-mono text-sm text-[var(--muted)]">{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</div>
                </div>
                <span className="text-xs text-[var(--muted)]">{formatDate(event.recorded_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-xl font-black">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{note}</div>
    </div>
  );
}
