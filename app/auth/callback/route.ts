import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only allow redirects to paths on this site. Rejects absolute URLs ("https://evil.com")
// and protocol-relative URLs ("//evil.com") that would otherwise leave the site.
function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired, already-used or malformed email links end up here.
    return NextResponse.redirect(new URL("/login?error=invalid_link", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
