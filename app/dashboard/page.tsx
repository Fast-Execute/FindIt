import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS, describeSubscription, formatDateTime, getAccountSummary } from "@/lib/account";

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
};

type EventRow = {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  battery_pct: number | null;
  recorded_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const account = await getAccountSummary(supabase);
  if (!account) notFound();

  const [{ data: deviceData }, { data: eventData }] = await Promise.all([
    supabase
      .from("devices")
      .select("id,name,model,status,battery_pct,last_seen_at,last_latitude,last_longitude,last_location_accuracy_m")
      .eq("owner_id", account.userId)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("location_events")
      .select("id,device_id,latitude,longitude,accuracy_m,battery_pct,recorded_at")
      .eq("owner_id", account.userId)
      .order("recorded_at", { ascending: false })
      .limit(5),
  ]);

  const devices = (deviceData ?? []) as DeviceRow[];
  const events = (eventData ?? []) as EventRow[];
  const deviceNames = new Map(devices.map((d) => [d.id, d.name]));
  const device = devices[0] ?? null;

  const plan = describeSubscription(account.subscription);
  const active = account.subscription?.status === "ACTIVE";
  const limit = active && account.subscription ? PLANS[account.subscription.plan].deviceLimit : null;
  const usedPercent = limit ? Math.min(100, Math.round((account.deviceCount / limit) * 100)) : 0;

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
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
          {device ? (
            <>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-[var(--muted)]">{device.model}</div>
                  <h2 className="mt-1 text-2xl font-black">{device.name}</h2>
                </div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${device.status === "ONLINE" ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-yellow-400/10 text-yellow-300"}`}>{device.status}</span>
              </div>
              <div className="grid gap-5 py-6 sm:grid-cols-3">
                <Metric label="Last seen" value={formatDateTime(device.last_seen_at)} note="Last report from the device" />
                <Metric label="Battery" value={device.battery_pct == null ? "—" : `${device.battery_pct}%`} note="Last reported" />
                <Metric label="Location" value={device.last_latitude == null ? "None yet" : "Reported"} note={device.last_location_accuracy_m == null ? "Accuracy unknown" : `±${device.last_location_accuracy_m} m`} />
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Last known location</div>
                    <div className="mt-2 text-lg font-bold">{device.last_latitude == null || device.last_longitude == null ? "No location reported yet" : `${device.last_latitude.toFixed(5)}, ${device.last_longitude.toFixed(5)}`}</div>
                  </div>
                  <Link href={`/dashboard/devices/${device.id}`} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)] hover:text-white">Open device</Link>
                </div>
                <div className="mt-5 grid h-52 place-items-center rounded-2xl border border-[var(--line)] bg-[radial-gradient(circle_at_35%_35%,rgba(98,230,168,.16),transparent_28%),linear-gradient(135deg,#142238,#0b111c)]">
                  <div className="text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]">●</div>
                    <div className="mt-3 text-sm font-bold">Map integration pending</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid place-items-center px-4 py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--line)] text-xl">+</div>
              <h2 className="mt-4 text-xl font-black">No devices enrolled yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Enroll a device you own to start seeing its status and last known location here.</p>
              <Link href="/dashboard/devices/enroll" className="mt-5 inline-flex rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-bold">Start enrollment</Link>
            </div>
          )}
        </article>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Subscription</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <div className="text-2xl font-black">{plan.headline}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{plan.detail}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-white/5 text-[var(--muted)]"}`}>{plan.badge}</span>
            </div>
            {limit ? (
              <>
                <div className="mt-5 h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${usedPercent}%` }} /></div>
                <div className="mt-2 text-xs text-[var(--muted)]">{account.deviceCount} of {limit} device slots used</div>
              </>
            ) : (
              <div className="mt-5 text-xs text-[var(--muted)]">{account.deviceCount} {account.deviceCount === 1 ? "device" : "devices"} enrolled</div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="text-sm text-[var(--muted)]">Recovery actions</div>
            <div className="mt-4 grid gap-3">
              {["Enable Lost Mode", "Alert me when online", "View location history"].map((label) => (
                <button key={label} disabled className="cursor-not-allowed rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold opacity-50">{label}</button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">These actions are not available yet. They will be connected in a later update.</p>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Recent recovery events</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Authorized status and location records.</p>
          </div>
          <span className="hidden text-xs text-[var(--muted)] sm:block">{events.length} {events.length === 1 ? "record" : "records"}</span>
        </div>
        {events.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">No location events yet. They appear here once an enrolled device reports in.</p>
        ) : (
          <div className="mt-6 divide-y divide-[var(--line)]">
            {events.map((event) => (
              <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                <div className="text-sm font-bold text-[var(--accent)]">{formatDateTime(event.recorded_at)}</div>
                <div>
                  <div className="font-semibold">Location reported · {deviceNames.get(event.device_id) ?? "Device"}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                    {event.accuracy_m != null ? ` · ±${event.accuracy_m} m` : ""}
                    {event.battery_pct != null ? ` · ${event.battery_pct}% battery` : ""}
                  </div>
                </div>
                <span className="text-xs text-[var(--muted)]">Authorized</span>
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
