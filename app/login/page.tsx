"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
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
          {message && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{message}</p>}
          <p className="mt-6 text-center text-sm text-[var(--muted)]">New to FindIt? <Link href="/signup" className="font-bold text-white hover:text-[var(--accent)]">Create an account</Link></p>
        </div>
      </div>
    </main>
  );
}
