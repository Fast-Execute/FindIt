// Display helpers for plans. What each plan actually allows is enforced in the
// database (see public.plan_limits in supabase/migrations/0005); this file only
// shapes what we show and never decides access.

export type PlanStatus = {
  plan: "FREE" | "BASIC" | "PLUS" | "FAMILY";
  subscription_status: "NONE" | "INACTIVE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  max_devices: number;
  device_count: number;
  lost_mode: boolean;
  reconnect_alerts: boolean;
  current_period_end: string | null;
};

export const PLAN_LABELS: Record<PlanStatus["plan"], string> = {
  FREE: "Free",
  BASIC: "Basic",
  PLUS: "Plus",
  FAMILY: "Family",
};

export function planLabel(plan: string) {
  return PLAN_LABELS[plan as PlanStatus["plan"]] ?? plan;
}

export function stripErrorCode(message: string) {
  return message.replace(/^[A-Z_]+:\s*/, "");
}

export function isUpgradeError(message: string) {
  return message.startsWith("UPGRADE_REQUIRED") || message.startsWith("DEVICE_LIMIT_REACHED");
}

export type DeviceAlert = {
  id: number;
  device_id: string;
  kind: "RECONNECTED" | "WENT_OFFLINE" | "LOST_MODE_ENABLED" | "LOST_MODE_DISABLED";
  message: string | null;
  created_at: string;
  read_at: string | null;
};

export function formatDateTime(value: string | null) {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
