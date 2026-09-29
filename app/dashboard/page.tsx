const device = { name: "My Phone", model: "Samsung Galaxy", status: "OFFLINE", lastSeen: "23:14", battery: "18%", location: "Pretoria, Gauteng" };
const events = [
  ["23:14", "Device went offline", "Last connection recorded"],
  ["23:11", "Location verified", "Pretoria, Gauteng"],
  ["22:58", "Battery reported", "18% remaining"],
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Overview</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Your recovery dashboard.</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">See the most recent verified state of every enrolled device. FindIt never presents an old location as live.</p></div>
        <a href="/dashboard/devices" className="rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-bold text-[#06100b] hover:brightness-110">+ Add device</a>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.5fr_.7fr]">
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm text-[var(--muted)]">{device.model}</div><h2 className="mt-1 text-2xl font-black">{device.name}</h2></div><span className="w-fit rounded-full bg-yellow-400/10 px-3 py-1.5 text-xs font-black text-yellow-300">{device.status}</span></div>
          <div className="grid gap-5 py-6 sm:grid-cols-3"><Metric label="Last seen" value={device.lastSeen} note="Today" /><Metric label="Battery" value={device.battery} note="Last reported" /><Metric label="Location" value="Verified" note={device.location} /></div>
          <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-5"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Last known location</div><div className="mt-2 text-lg font-bold">{device.location}</div></div><span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">Verified 23:11</span></div><div className="mt-5 grid h-52 place-items-center rounded-2xl border border-[var(--line)] bg-[radial-gradient(circle_at_35%_35%,rgba(98,230,168,.16),transparent_28%),linear-gradient(135deg,#142238,#0b111c)]"><div className="text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]">●</div><div className="mt-3 text-sm font-bold">Map integration pending</div><div className="mt-1 text-xs text-[var(--muted)]">Location: {device.location}</div></div></div></div>
        </article>
        <aside className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><div className="text-sm text-[var(--muted)]">Subscription</div><div className="mt-2 flex items-end justify-between gap-4"><div><div className="text-2xl font-black">Plus</div><div className="mt-1 text-xs text-[var(--muted)]">$9.99 / month · placeholder</div></div><span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--accent)]">ACTIVE</span></div><div className="mt-5 h-2 rounded-full bg-white/5"><div className="h-2 w-1/3 rounded-full bg-[var(--accent)]" /></div><div className="mt-2 text-xs text-[var(--muted)]">1 of 3 device slots used</div></div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><div className="text-sm text-[var(--muted)]">Recovery actions</div><div className="mt-4 grid gap-3"><button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold hover:border-[var(--accent)]">Enable Lost Mode</button><button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold hover:border-[var(--accent)]">Alert me when online</button><button className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold hover:border-[var(--accent)]">View location history</button></div><p className="mt-4 text-xs leading-5 text-[var(--muted)]">Actions become connected to real device services after authentication and device enrollment are implemented.</p></div>
        </aside>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Recent recovery events</h2><p className="mt-1 text-sm text-[var(--muted)]">Authorized status and location records.</p></div><span className="hidden text-xs text-[var(--muted)] sm:block">3 records</span></div><div className="mt-6 divide-y divide-[var(--line)]">{events.map(([time,title,detail]) => <div key={time+title} className="grid gap-2 py-4 sm:grid-cols-[80px_1fr_auto] sm:items-center"><div className="text-sm font-bold text-[var(--accent)]">{time}</div><div><div className="font-semibold">{title}</div><div className="text-sm text-[var(--muted)]">{detail}</div></div><span className="text-xs text-[var(--muted)]">Authorized</span></div>)}</div></section>
    </div>
  );
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <div><div className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">{label}</div><div className="mt-2 text-xl font-black">{value}</div><div className="mt-1 text-xs text-[var(--muted)]">{note}</div></div>;}
