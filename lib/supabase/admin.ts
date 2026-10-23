import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only: it bypasses row-level security, so never
 * import this from a client component or expose the key to the browser.
 * Returns null when the service is not configured.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
