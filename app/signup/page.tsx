export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-8">
        <a href="/" className="text-sm text-[var(--muted)]">← Back to FindIt</a>
        <h1 className="mt-8 text-3xl font-black">Protect a device.</h1>
        <p className="mt-2 text-[var(--muted)]">Create your account first. Device enrollment and billing will follow.</p>
        <form className="mt-8 space-y-4">
          <input className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none" placeholder="Name" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none" placeholder="Email address" type="email" />
          <button className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-bold text-[#06100b]" type="button">Create account</button>
        </form>
      </section>
    </main>
  );
}
