import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase auth code for a session cookie.
 *
 * Reached either directly, or via the proxy when a confirmation link lands on
 * the site root — Supabase redirects to the project's Site URL, which is the
 * root by default.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(next.startsWith("/") ? next : "/today", origin),
      );
    }
  }

  // An expired or already-used link is the common case here, and it is
  // recoverable: the account exists, it just needs a fresh link or a sign-in.
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
