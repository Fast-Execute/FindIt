"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, inputClass } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/callback?next=/reset-password",
    });

    // Show the same confirmation whether or not the address has an account, so this
    // page can't be used to find out which emails are registered. Only real failures
    // (such as rate limiting) are reported.
    if (resetError && resetError.status === 429) {
      setError("Too many requests. Please wait a few minutes and try again.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell eyebrow="Account" title="Reset your password." intro="Enter your account email and we will send you a link to choose a new password.">
      {sent ? (
        <p className="mt-8 rounded-2xl border border-[var(--line)] bg-white/[.03] p-4 text-sm leading-6 text-[var(--muted)]">
          If an account exists for <span className="font-bold text-white">{email}</span>, a reset link is on its way. The link expires after a short time, so use it soon.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={inputClass} placeholder="you@example.com" />
          </label>
          <button disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3.5 font-bold text-[#06100b] disabled:opacity-60">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link href="/login" className="font-bold text-white hover:text-[var(--accent)]">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
