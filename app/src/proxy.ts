// Next.js 16 renamed `middleware` -> `proxy`. Runtime is nodejs only.
// Refreshes Supabase auth session cookies and logs all requests.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_EMAIL = "lcy080813@gmail.com";

// ---------------------------------------------------------------------------
// Request logger — structured JSON, easy to pipe to any log aggregator
// ---------------------------------------------------------------------------

function extractUserIdFromCookies(req: NextRequest): string | null {
  for (const [name, cookie] of req.cookies) {
    if (!name.startsWith("sb-") || !name.endsWith("-auth-token")) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(cookie.value)) as unknown;
      const accessToken = Array.isArray(parsed)
        ? (parsed[0] as string | undefined)
        : (parsed as Record<string, unknown>)?.access_token;
      if (typeof accessToken !== "string") continue;
      const payloadB64 = accessToken.split(".")[1];
      if (!payloadB64) continue;
      const payload = JSON.parse(
        atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
      ) as Record<string, unknown>;
      if (typeof payload.sub === "string") return payload.sub;
    } catch {
      // Malformed cookie — skip
    }
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const start = Date.now();
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
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

  // Touching getUser forces token refresh if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Admin area must be invisible to everyone but the admin: respond with a
  // plain 404 directly, never a login redirect that would reveal the route
  // exists. (NextResponse.rewrite to a nonexistent pathname does not work
  // here — Next still resolves and renders the original route.)
  if (pathname.startsWith("/admin") && user?.email !== ADMIN_EMAIL) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isAppArea =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/applications") ||
    pathname.startsWith("/resumes") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/tracker") ||
    pathname.startsWith("/settings");

  if (!user && isAppArea) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  // Gate /applications/new: require at least one uploaded resume.
  if (user && pathname === "/applications/new") {
    const { count } = await supabase
      .from("base_resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/resumes";
      redirect.search = "?needResume=1";
      return NextResponse.redirect(redirect);
    }
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.nextUrl.pathname,
      userId: extractUserIdFromCookies(request) ?? "anonymous",
      duration_ms: Date.now() - start,
    }),
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
