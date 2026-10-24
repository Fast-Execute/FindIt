"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isUpgradeError, stripErrorCode } from "@/lib/plans";

type Props = {
  deviceId: string;
  lostMode: boolean;
  lostMessage: string | null;
  lostContact: string | null;
  notifyOnReconnect: boolean;
  canLostMode: boolean;
  canReconnectAlerts: boolean;
};

export default function RecoveryControls(props: Props) {
  const router = useRouter();
  const [message, setMessage] = useState(props.lostMessage ?? "");
  const [contact, setContact] = useState(props.lostContact ?? "");
  const [busy, setBusy] = useState<"lost" | "alerts" | null>(null);
  const [error, setError] = useState("");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  async function run(kind: "lost" | "alerts", call: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(kind);
    setError("");
    setNeedsUpgrade(false);
    const { error: rpcError } = await call();
    setBusy(null);
    if (rpcError) {
      setError(stripErrorCode(rpcError.message));
      setNeedsUpgrade(isUpgradeError(rpcError.message));
      return;
    }
    router.refresh();
  }

  function setLostMode(enabled: boolean) {
    return run("lost", () =>
      createClient().rpc("set_lost_mode", {
        p_device_id: props.deviceId,
        p_enabled: enabled,
        p_message: message,
        p_contact: contact,
      }),
    );
  }

  function setReconnectAlerts(enabled: boolean) {
    return run("alerts", () =>
      createClient().rpc("set_reconnect_alerts", {
        p_device_id: props.deviceId,
        p_enabled: enabled,
      }),
    );
  }

  return (
    <article className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-black">Recovery controls</h2>
        {props.lostMode && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">LOST MODE ON</span>}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-black/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Alert me when online</div>
            <div className="mt-1 text-xs leading-5 text-[var(--muted)]">One-time alert the next time this device reports in.</div>
          </div>
          <button
            type="button"
            disabled={busy !== null || (!props.canReconnectAlerts && !props.notifyOnReconnect)}
            onClick={() => setReconnectAlerts(!props.notifyOnReconnect)}
            className="shrink-0 rounded-full border border-[var(--line)] px-4 py-2 text-xs font-bold hover:border-[var(--accent)] disabled:opacity-50"
          >
            {busy === "alerts" ? "Saving..." : props.notifyOnReconnect ? "Turn off" : "Turn on"}
          </button>
        </div>
        {!props.canReconnectAlerts && <p className="mt-3 text-xs text-[var(--muted)]">Included with Basic, Plus and Family.</p>}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-black/10 p-4">
        <div className="text-sm font-bold">Lost Mode</div>
        {props.canLostMode || props.lostMode ? (
          <>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Asks the enrolled companion to report more often and show your message. It never bypasses device security.
            </p>
            <label className="mt-4 block text-xs font-semibold">
              Message for whoever finds it
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={280}
                rows={3}
                placeholder="This phone is lost. Please contact me to return it."
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Contact detail
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                maxLength={120}
                placeholder="Phone number or email"
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setLostMode(true)}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-bold text-[#06100b] disabled:opacity-60"
              >
                {busy === "lost" ? "Saving..." : props.lostMode ? "Update Lost Mode" : "Enable Lost Mode"}
              </button>
              {props.lostMode && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setLostMode(false)}
                  className="rounded-full border border-[var(--line)] px-5 py-2.5 text-xs font-bold hover:border-white/30 disabled:opacity-60"
                >
                  Turn off
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Faster location reporting and an on-screen message for whoever finds your device. Included with Plus and Family.
            </p>
            <Link href="/dashboard/billing" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black">See plans</Link>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/5 p-4 text-sm text-red-200">
          {error}
          {needsUpgrade && <Link href="/dashboard/billing" className="ml-2 font-bold underline">See plans</Link>}
        </div>
      )}
    </article>
  );
}
