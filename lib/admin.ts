import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every admin page and route must call this first. Anyone who is not a signed-in admin
// gets a plain 404, so the console's existence is not confirmed to them.
//
// This is a second lock, not the only one: the database refuses every admin query from a
// non-admin on its own (migration 0008), so a page that forgets this call still leaks nothing.
// getUser() asks Supabase to validate the session rather than trusting the cookie.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  return { supabase, user };
}
