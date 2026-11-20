import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-black"><span className="text-[var(--accent)]">Find</span>It</Link>
        <div className="mt-16 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{intro}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

export const inputClass =
  "mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]";
