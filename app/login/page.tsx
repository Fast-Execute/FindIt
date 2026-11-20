"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendNote, setResendNote] = useState("");

  // /auth/callback sends people here with ?error=invalid_link when an emailed link
  // (verification or password reset) is expired, already used, or malformed.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "invalid_link") {
      setMessage("That email link has expired or was already used. Sign in, or request a new password reset link.");
    }
  }, []);

  async function resendConfirmation() {
    setResendNote("");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/auth/callback?next=/dashboard" },
    });
    setResendNote(error ? "Could not resend right now. Please wait a minute and try again." : "Confirmation email sent. Check your inbox.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setUnconfirmed(false);
    setResendNote("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
        setMessage("Please confirm your email address before signing in. Check your inbox for the confirmation link.");
      } else {
        setMessage(error.message);
      }
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-black"><span className="text-[var(--accent)]">Find</span>It</Link>
        <div className="mt-16 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Account</p>
          <h1 className="mt-3 text-3xl font-black">Welcome back.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Sign in to manage your enrolled devices.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-semibold">Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="you@example.com" /></label>
            <label className="block text-sm font-semibold">Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={6} className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="••••••••" /></label>
            <button disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3.5 font-bold text-[#06100b] disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
          </form>
          <p className="mt-4 text-right text-sm"><Link href="/forgot-password" className="font-bold text-[var(--muted)] hover:text-white">Forgot password?</Link></p>
          {message && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{message}</p>}
          {unconfirmed && (
            <div className="mt-3">
              <button type="button" onClick={resendConfirmation} className="w-full rounded-2xl border border-[var(--line)] px-5 py-3 text-sm font-bold hover:border-[var(--accent)]">Resend confirmation email</button>
              {resendNote && <p className="mt-3 text-center text-sm text-[var(--muted)]">{resendNote}</p>}
            </div>
          )}
          <p className="mt-6 text-center text-sm text-[var(--muted)]">New to FindIt? <Link href="/signup" className="font-bold text-white hover:text-[var(--accent)]">Create an account</Link></p>
        </div>
      </div>
    </main>
  );
}
