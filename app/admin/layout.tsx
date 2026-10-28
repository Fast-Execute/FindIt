import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin · FindIt",
  robots: { index: false, follow: false },
};

// Always rendered per request: never cached, never served to someone else.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A layout is not a security boundary on its own (pages re-check), but failing early
  // means a non-admin never receives any admin markup.
  const { user } = await requireAdmin();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--background)]/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight"><span className="text-[var(--accent)]">Find</span>It</span>
            <span className="rounded-full border border-[var(--accent)]/40 px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-[var(--accent)]">Admin</span>
            <span className="hidden rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)] sm:inline">Read-only</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-[var(--muted)] md:inline">{user.email}</span>
            <Link href="/dashboard" className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold text-[var(--muted)] hover:border-white/30 hover:text-white">Back to dashboard</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
