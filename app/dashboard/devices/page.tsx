import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DevicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: devices } = user
    ? await supabase.from("devices").select("id,name,model,status,battery_pct,last_seen_at").eq("owner_id", user.id).order("created_at", { ascending: false })
    : { data: [] };

  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Devices</p><h1 className="mt-3 text-4xl font-black tracking-tight">My devices.</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Enroll only devices you own or are explicitly authorized to manage.</p></div>
      <Link href="/dashboard/devices/enroll" className="rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-bold text-[#06100b]">+ Enroll a device</Link>
    </section>
    {devices && devices.length > 0 ? <section className="grid gap-5 lg:grid-cols-2">{devices.map((device: { id: string; name: string; model: string | null; status: string; battery_pct: number | null; last_seen_at: string | null })=><article key={device.id} className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm text-[var(--muted)]">{device.model}</div><h2 className="mt-1 text-2xl font-black">{device.name}</h2></div><span className="rounded-full bg-yellow-400/10 px-3 py-1.5 text-xs font-black text-yellow-300">{device.status}</span></div><div className="mt-6 grid grid-cols-2 gap-4"><Info label="Last seen" value={formatDate(device.last_seen_at)}/><Info label="Battery" value={device.battery_pct == null ? "—" : device.battery_pct + "%"}/><Info label="Access" value="Authorized"/><Info label="Recovery" value="Protected"/></div><Link href={`/dashboard/devices/${device.id}`} className="mt-6 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-black">Open device</Link></article>)}</section> : <section className="rounded-3xl border border-dashed border-[var(--line)] bg-white/[.02] p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--line)] text-xl">+</div><h2 className="mt-4 text-xl font-black">No devices enrolled yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Create your first authorized device record, then connect the compatible device component.</p><Link href="/dashboard/devices/enroll" className="mt-5 inline-flex rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-bold">Start enrollment</Link></section>}
  </div>;
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-[var(--line)] bg-black/10 p-4"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>}
function formatDate(value:string|null){return value ? new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)) : "Not reported";}