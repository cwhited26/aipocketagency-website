import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_APP_PREFIXES = ["/app/login", "/app/auth"];

function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_APP_PREFIXES.some((p) => pathname.startsWith(p));
}

async function checkSubscription(userId: string): Promise<boolean> {
  const url =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.WC_ADMIN_SUPABASE_URL ?? "").replace(
      /\/$/,
      "",
    );
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.WC_ADMIN_SUPABASE_SERVICE_KEY ?? "";
  if (!url || !key) return true;

  const endpoint =
    `${url}/rest/v1/pocket_agent_subscriptions` +
    `?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing)&limit=1`;
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return true; // table doesn't exist yet → allow
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true;
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

  const hasSubscription = await checkSubscription(user.id);
  if (!hasSubscription) {
    return NextResponse.redirect(new URL("/pocket-agent?expired=true", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*", "/api/app/:path*"],
};
