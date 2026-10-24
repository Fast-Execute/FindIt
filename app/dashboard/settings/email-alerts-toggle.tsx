"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EmailAlertsToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError("");
    const { error: rpcError } = await createClient().rpc("set_email_alerts", { p_enabled: next });
    setBusy(false);
    if (rpcError) {
      setError("Could not save that. Please try again.");
      return;
    }
    setEnabled(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold">Device emails</div>
          <div className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Reconnects, going offline and Lost Mode changes. Receipts and payment problems are always sent.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Device emails"
          disabled={busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border border-[var(--line)] transition-colors disabled:opacity-60 ${enabled ? "bg-[var(--accent)]" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
