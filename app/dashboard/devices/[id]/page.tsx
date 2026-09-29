import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: device, error } = await supabase
    .from("devices")
    .select("id,name,model,platform,status,battery_pct,last_seen_at,last_latitude,last_longitude,last_location_accuracy_m,enrollment_code,created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (error || !device) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <Link href="/dashboard/devices" className="text-sm font-semibold text-[var(--muted)] hover:text-white">← Back to devices</Link>
        <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">{device.platform}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">{device.name}</h1>
            <p className="mt-2 text-[var(--muted)]">{device.model}</p>
          </div>
          <span className="w-fit rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-black text-yellow-300">{device.status}</span>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Battery" value={device.battery_pct == null ? "—" : device.battery_pct + "%"} />
        <Metric label="Last seen" value={formatDate(device.last_seen_at)} />
        <Metric label="Latitude" value={device.last_latitude == null ? "—" : String(device.last_latitude)} />
        <Metric label="Longitude" value={device.last_longitude == null ? "—" : String(device.last_longitude)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="text-xl font-black">Recovery map</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">A map provider can be connected after location ingestion is enabled.</p>
          <div className="mt-5 grid h-72 place-items-center rounded-2xl border border-[var(--line)] bg-black/20 text-center">
            <div><div className="text-2xl">⌖</div><div className="mt-2 font-bold">{device.last_latitude == null ? "No location reported yet" : "Last authorized coordinates available"}</div><div className="mt-1 text-xs text-[var(--muted)]">{device.last_location_accuracy_m == null ? "Waiting for a device event" : `Accuracy ±${device.last_location_accuracy_m} m`}</div></div>
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <h2 className="text-xl font-black">Enrollment</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This identifier links the authorized device record to the future companion component.</p>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-black/10 p-4">
              <div className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Enrollment code</div>
              <div className="mt-2 font-mono text-lg font-black tracking-[.15em]">{device.enrollment_code ?? "Pending"}</div>
            </div>
          </article>
          <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <h2 className="text-xl font-black">Recovery controls</h2>
            <div className="mt-4 grid gap-3">
              <button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold">Enable Lost Mode</button>
              <button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold">Alert me when online</button>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Controls remain inactive until the device component is connected and authorized.</p>
          </article>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h2 className="text-xl font-black">Device identity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Info label="Device ID" value={device.id} />
          <Info label="Added" value={formatDate(device.created_at)} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5"><div className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">{label}</div><div className="mt-2 break-all text-xl font-black">{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-black/10 p-4"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-1 break-all text-sm font-bold">{value}</div></div>;
}

function formatDate(value: string | null) {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}