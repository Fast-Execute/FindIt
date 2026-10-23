export type DeviceStatus = "ONLINE" | "OFFLINE" | "POWERED_OFF" | "UNREACHABLE";

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** "5 min ago" style label, so old locations are never presented as live. */
export function timeAgo(value: string | null | undefined, now = Date.now()) {
  if (!value) return "never";
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  POWERED_OFF: "Powered off",
  UNREACHABLE: "Unreachable",
};

export const STATUS_STYLES: Record<DeviceStatus, string> = {
  ONLINE: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  OFFLINE: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
  POWERED_OFF: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  UNREACHABLE: "border-slate-400/20 bg-slate-400/10 text-slate-300",
};
