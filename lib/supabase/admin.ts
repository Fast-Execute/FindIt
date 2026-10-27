import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only: bypasses RLS, so never import it from a
 * client component and never expose its results without checking ownership.
 * Returns null when the project is not configured.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
