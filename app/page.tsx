const plans = [
  {
    name: "Basic",
    price: "$4.99",
    description: "For protecting one personal device.",
    features: ["1 enrolled device", "Last-known location", "Reconnect alerts"],
  },
  {
    name: "Plus",
    price: "$9.99",
    description: "For people who want more recovery history.",
    features: ["Up to 3 devices", "Location history", "Lost Mode", "Priority alerts"],
    featured: true,
  },
  {
    name: "Family",
    price: "$14.99",
    description: "For managing authorized family devices.",
    features: ["Up to 10 devices", "Shared management", "Extended history", "Recovery alerts"],
  },
];

export default function Home() {
  return (
    <main>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <a href="/" className="text-xl font-black tracking-tight">
          <span className="text-[var(--accent)]">Find</span>It
        </a>
        <div className="hidden gap-8 text-sm text-[var(--muted)] md:flex">
          <a href="#how-it-works" className="hover:text-white">How it works</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </div>
        <a href="/login" className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)]">
          Sign in
        </a>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/[.03] px-4 py-2 text-sm text-[var(--muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Device recovery, built around consent.
          </div>
          <h1 className="text-5xl font-black leading-[.95] tracking-[-.04em] sm:text-7xl lg:text-8xl">
            Find your phone.
            <span className="block text-[var(--accent)]">Protect what matters.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            FindIt keeps your recovery plan working when your device goes offline:
            live location while connected, last-known location when disconnected,
            and alerts when your enrolled device returns.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#pricing" className="rounded-full bg-[var(--accent)] px-7 py-4 text-center font-bold text-[#06100b] hover:brightness-110">
              Start protecting a device
            </a>
            <a href="#how-it-works" className="rounded-full border border-[var(--line)] px-7 py-4 text-center font-bold hover:border-white/30">
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Enroll", "Connect a device you own or are authorized to manage."],
            ["02", "Protect", "FindIt records authorized location and device status."],
            ["03", "Recover", "Use the dashboard, last-known location and reconnect alerts."],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-7">
              <div className="text-sm font-bold text-[var(--accent)]">{number}</div>
              <h2 className="mt-5 text-2xl font-bold">{title}</h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-[var(--line)] bg-white/[.02]">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-24 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Recovery dashboard</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Know the last verified state.</h2>
            <p className="mt-5 max-w-xl leading-8 text-[var(--muted)]">
              A recovery dashboard should clearly separate what is known now from
              what was known before a device went offline.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
              <div>
                <div className="font-bold">My Phone</div>
                <div className="text-sm text-[var(--muted)]">Enrolled device</div>
              </div>
              <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">OFFLINE</span>
            </div>
            <div className="grid gap-5 py-6 sm:grid-cols-3">
              <div><div className="text-xs text-[var(--muted)]">Last seen</div><div className="mt-1 font-bold">23:14</div></div>
              <div><div className="text-xs text-[var(--muted)]">Battery</div><div className="mt-1 font-bold">18%</div></div>
              <div><div className="text-xs text-[var(--muted)]">Location</div><div className="mt-1 font-bold">Last verified</div></div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-5">
              <div className="text-sm text-[var(--muted)]">Last known location</div>
              <div className="mt-2 text-xl font-bold">Device location awaiting map integration</div>
              <div className="mt-4 h-32 rounded-xl bg-gradient-to-br from-[#142238] to-[#0b111c] grid place-items-center text-sm text-[var(--muted)]">MAP VIEW</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Built honestly</p>
        <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
          Offline does not mean we pretend to have a signal.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Online", "Fresh authorized location can be displayed when the device is reachable."],
            ["Offline", "FindIt shows the most recent verified location and timestamp."],
            ["Powered off", "A normal web service cannot universally obtain a fresh GPS position from a completely powered-off phone."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-[var(--line)] p-7">
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-[var(--line)] bg-white/[.02]">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Monthly protection</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Choose your plan.</h2>
            <p className="mt-4 text-[var(--muted)]">Pricing shown is a design placeholder. We will connect the final billing provider before launch.</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`rounded-3xl border p-7 ${plan.featured ? "border-[var(--accent)] bg-[var(--panel)]" : "border-[var(--line)] bg-[var(--panel)]/50"}`}>
                {plan.featured && <div className="mb-5 text-xs font-bold uppercase tracking-[.15em] text-[var(--accent)]">Most flexible</div>}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="mt-5 text-4xl font-black">{plan.price}<span className="text-base font-normal text-[var(--muted)]"> / month</span></div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--muted)]">{plan.description}</p>
                <ul className="mt-7 space-y-3 text-sm">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-[var(--accent)]">✓</span>{feature}</li>)}
                </ul>
                <a href="/signup" className="mt-8 block rounded-full border border-[var(--line)] px-5 py-3 text-center font-bold hover:border-[var(--accent)]">Choose {plan.name}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>© 2026 FindIt. Device recovery with consent.</div>
        <div className="flex gap-5"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
      </footer>
    </main>
  );
}
