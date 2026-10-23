import { STATUS_LABELS, STATUS_STYLES, type DeviceStatus } from "@/lib/devices";

export default function StatusBadge({ status }: { status: string }) {
  const known = status in STATUS_STYLES;
  const style = known ? STATUS_STYLES[status as DeviceStatus] : STATUS_STYLES.UNREACHABLE;
  const label = known ? STATUS_LABELS[status as DeviceStatus] : status;
  return <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${style}`}>{label}</span>;
}
