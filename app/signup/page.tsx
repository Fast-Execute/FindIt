"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function resendConfirmation() {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/auth/callback?next=/dashboard" },
    });
    setMessage(error ? "Could not resend right now. Please wait a minute and try again." : "Confirmation email sent again. Check your inbox.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + "/auth/callback?next=/dashboard",
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      window.location.href = "/dashboard";
      return;
    }
    setMessage("Account created. Check your email to confirm your address, then sign in.");
    setAwaitingConfirmation(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-black"><span className="text-[var(--accent)]">Find</span>It</Link>
        <div className="mt-16 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Get protected</p>
          <h1 className="mt-3 text-3xl font-black">Create your account.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Create an account before enrolling a device you own or are authorized to manage.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-semibold">Name<input value={name} onChange={e=>setName(e.target.value)} type="text" required className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="Your name" /></label>
            <label className="block text-sm font-semibold">Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="you@example.com" /></label>
            <label className="block text-sm font-semibold">Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={6} className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="At least 6 characters" /></label>
            <button disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3.5 font-bold text-[#06100b] disabled:opacity-60">{loading ? "Creating..." : "Create account"}</button>
          </form>
          {message && <p className="mt-4 rounded-2xl border border-[var(--line)] bg-white/[.03] p-4 text-sm text-[var(--muted)]">{message}</p>}
          {awaitingConfirmation && <button type="button" onClick={resendConfirmation} className="mt-3 w-full rounded-2xl border border-[var(--line)] px-5 py-3 text-sm font-bold hover:border-[var(--accent)]">Resend confirmation email</button>}
          <p className="mt-6 text-center text-sm text-[var(--muted)]">Already have an account? <Link href="/login" className="font-bold text-white hover:text-[var(--accent)]">Sign in</Link></p>
        </div>
      </div>
    </main>
  );
}
