"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, inputClass } from "@/components/auth-shell";

type Session = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [session, setSession] = useState<Session>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The emailed link goes through /auth/callback, which signs the user in with a
  // short-lived recovery session. Without that session there is nothing to reset.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setSession(user ? "valid" : "invalid"));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  if (session === "checking") {
    return (
      <AuthShell eyebrow="Account" title="Choose a new password." intro="Checking your reset link...">
        <></>
      </AuthShell>
    );
  }

  if (session === "invalid") {
    return (
      <AuthShell eyebrow="Account" title="This link has expired." intro="Password reset links work once and expire quickly. Request a new one to continue.">
        <Link href="/forgot-password" className="mt-8 block rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-center font-bold text-[#06100b]">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Account" title="Choose a new password." intro="Pick a password you do not use anywhere else.">
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-semibold">New password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} autoComplete="new-password" className={inputClass} placeholder="At least 6 characters" />
        </label>
        <label className="block text-sm font-semibold">Confirm new password
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required minLength={6} autoComplete="new-password" className={inputClass} placeholder="Repeat the password" />
        </label>
        <button disabled={loading} className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3.5 font-bold text-[#06100b] disabled:opacity-60">
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>
      {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
    </AuthShell>
  );
}
