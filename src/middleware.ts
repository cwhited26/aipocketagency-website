import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_APP_PREFIXES = ["/app/login", "/app/auth", "/api/app/auth"];

function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_APP_PREFIXES.some((p) => pathname.startsWith(p));
}

async function checkSubscription(userId: string, email: string | null): Promise<boolean> {
  const url = (
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY ??
    "";
  if (!url || !key) return true;

  const TABLE = "pocket_agent_subscriptions";

  // Primary check: by user_id (covers users whose subscription is already linked)
  const byUserId =
    `${url}/rest/v1/${TABLE}` +
    `?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trial)&limit=1`;
  try {
    const res = await fetch(byUserId, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return true; // table doesn't exist yet → allow
    const rows = (await res.json()) as unknown[];
    if (Array.isArray(rows) && rows.length > 0) return true;
  } catch {
    return true;
  }

  // Fallback: check by email for users who just paid but haven't hit the
  // auth callback yet to link their user_id (handles the pay → first login race).
  if (!email) return false;
  const byEmail =
    `${url}/rest/v1/${TABLE}` +
    `?email=eq.${encodeURIComponent(email)}&status=in.(active,trial)&limit=1`;
  try {
    const res = await fetch(byEmail, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAppPath = pathname.startsWith("/app") || pathname.startsWith("/api/app");
  if (!isAppPath) return supabaseResponse;
  if (isPublicAppPath(pathname)) return supabaseResponse;

  if (!user) {
    return NextResponse.redirect(new URL("/app/login", request.url));
  }

  const hasSubscription = await checkSubscription(user.id, user.email ?? null);
  if (!hasSubscription) {
    return NextResponse.redirect(new URL("/pocket-agent?expired=true", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*", "/api/app/:path*"],
};
