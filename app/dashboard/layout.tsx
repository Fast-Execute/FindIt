import Link from "next/link";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/dashboard/devices", label: "My Devices", icon: "▣" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--line)] bg-[var(--panel)]/95 p-5 md:block">
        <Link href="/" className="block px-3 py-3 text-xl font-black tracking-tight"><span className="text-[var(--accent)]">Find</span>It</Link>
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/[.02] p-4">
          <div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Account</div>
          <div className="mt-2 font-semibold">Personal recovery</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Subscription active</div>
        </div>
        <nav className="mt-6 space-y-1">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-white/[.04] hover:text-white">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-xs">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-[var(--line)] p-4 text-xs leading-5 text-[var(--muted)]">Only devices you own or are authorized to manage can be enrolled.</div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--background)]/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between">
            <div><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">FindIt Dashboard</div><div className="mt-1 font-semibold">Device recovery center</div></div>
            <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--muted)] hover:border-white/30 hover:text-white">Back to site</Link>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-[var(--line)] px-5 py-3 md:hidden">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">{item.label}</Link>)}
        </nav>
        <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
