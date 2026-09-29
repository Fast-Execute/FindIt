"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <button onClick={signOut} disabled={loading} className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-left text-xs font-bold text-[var(--muted)] hover:border-white/30 hover:text-white disabled:opacity-60">{loading ? "Signing out…" : "Sign out"}</button>;
}