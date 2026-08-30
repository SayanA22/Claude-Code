import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/setup", "/manifest.webmanifest"];

/**
 * Runs before every matched request (Next.js proxy, formerly middleware).
 *
 * Refreshes the Supabase session cookie on each navigation and keeps
 * unauthenticated visitors out of the app shell.
 */
export default async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  // Supabase sends confirmation and recovery links back to the project's Site
  // URL, which is the site root by default — not /auth/callback. Landing there
  // with a code and no session would otherwise bounce to /login and drop the
  // code, leaving the account permanently unconfirmable. Route any stray code
  // to the handler that can exchange it.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", code);
    if (next?.startsWith("/")) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
