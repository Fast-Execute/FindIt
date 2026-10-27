"use client";

import { useState } from "react";

type Props = {
  plans: string[];
  hasBillingAccount: boolean;
  hasLiveSubscription: boolean;
};

const PLAN_LABELS: Record<string, string> = { BASIC: "Basic", PLUS: "Plus", FAMILY: "Family" };

const buttonClass =
  "rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold hover:border-[var(--accent)] disabled:opacity-50";

export default function BillingActions({ plans, hasBillingAccount, hasLiveSubscription }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(key: string, url: string, body?: unknown) {
    setPending(key);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {!hasLiveSubscription &&
          plans.map((plan) => (
            <button
              key={plan}
              type="button"
              disabled={pending !== null}
              onClick={() => go(plan, "/api/billing/checkout", { plan })}
              className={buttonClass}
            >
              {pending === plan ? "Redirecting…" : `Choose ${PLAN_LABELS[plan] ?? plan}`}
            </button>
          ))}
        {hasBillingAccount && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => go("portal", "/api/billing/portal")}
            className={buttonClass}
          >
            {pending === "portal" ? "Redirecting…" : "Manage billing"}
          </button>
        )}
      </div>
      {!hasLiveSubscription && plans.length === 0 && (
        <p className="text-xs text-[var(--muted)]">Plans are not available yet.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
