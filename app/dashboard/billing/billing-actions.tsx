"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutResponse = {
  ok?: boolean;
  error?: string;
  action?: string;
  fields?: [string, string][];
};

// Asks our server to create the checkout (it picks the amount), then posts the signed
// form to PayFast, which hosts the card page.
export function SubscribeButton({ plan, label, disabled, featured }: { plan: string; label: string; disabled?: boolean; featured?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !result.action || !result.fields) {
        setError(result.error ?? "Could not start checkout. Please try again.");
        setBusy(false);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.action;
      for (const [name, value] of result.fields) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Could not start checkout. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={subscribe}
        disabled={busy || disabled}
        className={`w-full rounded-full px-5 py-3 text-center text-sm font-bold disabled:opacity-50 ${featured ? "bg-[var(--accent)] text-[#06100b] hover:brightness-110" : "border border-[var(--line)] hover:border-[var(--accent)]"}`}
      >
        {busy ? "Redirecting to PayFast..." : label}
      </button>
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function CancelButton({ accessUntil }: { accessUntil: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    const until = accessUntil ? ` You keep access until ${accessUntil}.` : "";
    if (!window.confirm(`Cancel your subscription?${until}`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const result: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not cancel. Please try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rounded-full border border-red-400/30 px-5 py-2.5 text-xs font-bold text-red-200 hover:bg-red-500/5 disabled:opacity-50"
      >
        {busy ? "Cancelling..." : "Cancel subscription"}
      </button>
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
