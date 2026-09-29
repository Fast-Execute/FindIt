export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-8">
        <a href="/" className="text-sm text-[var(--muted)]">← Back to FindIt</a>
        <h1 className="mt-8 text-3xl font-black">Welcome back.</h1>
        <p className="mt-2 text-[var(--muted)]">Authentication will be connected in Phase 2.</p>
        <form className="mt-8 space-y-4">
          <input className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none" placeholder="Email address" type="email" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none" placeholder="Password" type="password" />
          <button className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-bold text-[#06100b]" type="button">Sign in</button>
        </form>
      </section>
    </main>
  );
}
