"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "token"; token: string; expiresAt: string | null }
  | { kind: "revoked" }
  | { kind: "error"; message: string };

export function CredentialControls({ deviceId }: { deviceId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function call(method: "POST" | "DELETE") {
    if (method === "POST" && !window.confirm("Generate a new device token? The current token will stop working immediately.")) return;
    if (method === "DELETE" && !window.confirm("Revoke this device's token? The device will stop reporting until you generate a new one.")) return;

    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/device/credential", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setState(method === "POST"
        ? { kind: "token", token: data.token, expiresAt: data.expires_at ?? null }
        : { kind: "revoked" });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }

  const busy = state.kind === "busy";

  return (
    <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="text-xl font-black">Device token</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        The token lets the authorized companion report location. Tokens expire after 90 days; rotate one any time, or revoke it if the device is retired.
      </p>
      <div className="mt-4 grid gap-3">
        <button disabled={busy} onClick={() => call("POST")} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold disabled:opacity-50">
          Rotate token
        </button>
        <button disabled={busy} onClick={() => call("DELETE")} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm font-bold disabled:opacity-50">
          Revoke token
        </button>
      </div>

      {state.kind === "token" && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-black/10 p-4">
          <div className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">New token (shown once)</div>
          <div className="mt-2 break-all font-mono text-sm font-black">{state.token}</div>
          {state.expiresAt && <div className="mt-2 text-xs text-[var(--muted)]">Expires {new Date(state.expiresAt).toLocaleDateString("en-ZA")}</div>}
        </div>
      )}
      {state.kind === "revoked" && <p className="mt-4 text-sm font-bold">Token revoked. The device can no longer report.</p>}
      {state.kind === "error" && <p className="mt-4 text-sm font-bold text-red-300">{state.message}</p>}
    </article>
  );
}
