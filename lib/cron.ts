import { timingSafeEqual } from "node:crypto";

// Scheduled routes accept only `Authorization: Bearer $CRON_SECRET`, compared in constant time.
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
