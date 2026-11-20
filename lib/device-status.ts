// A device that last reported longer ago than this is shown as OFFLINE.
// Keep in sync with the default in public.mark_stale_devices (migration 0005).
export const STALE_AFTER_MINUTES = 15;

// The status to display for a device. The stored status says ONLINE until the scheduled
// job (/api/cron/stale-devices) runs, so the UI also checks the last report time itself.
// This keeps FindIt from presenting an old state as current.
export function effectiveStatus(status: string, lastSeenAt: string | null): string {
  if (status !== "ONLINE") return status;
  if (!lastSeenAt) return "OFFLINE";
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  return ageMs > STALE_AFTER_MINUTES * 60 * 1000 ? "OFFLINE" : "ONLINE";
}
