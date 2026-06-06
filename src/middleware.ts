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

// Resolves the frame-ancestors CSP for a Mode C embed page from the widget's allowlist.
// Fails closed to 'self' (no third-party framing) on any lookup error, so a broken
// lookup never opens the persona to framing on an unlisted domain (Adversarial §3(h)).
async function frameAncestorsForToken(token: string): Promise<string> {
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
  if (!url || !key) return "'self'";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const tokRes = await fetch(
      `${url}/rest/v1/persona_share_tokens?token=eq.${encodeURIComponent(token)}&mode=eq.widget&select=persona_id&limit=1`,
      { headers, cache: "no-store" },
    );
    if (!tokRes.ok) return "'self'";
    const tok = (await tokRes.json()) as { persona_id?: string }[];
    const personaId = tok[0]?.persona_id;
    if (!personaId) return "'self'";

    const cfgRes = await fetch(
      `${url}/rest/v1/persona_widget_config?persona_id=eq.${encodeURIComponent(personaId)}&select=allowed_origins&limit=1`,
      { headers, cache: "no-store" },
    );
    if (!cfgRes.ok) return "'self'";
    const cfg = (await cfgRes.json()) as { allowed_origins?: string[] }[];
    const origins = (cfg[0]?.allowed_origins ?? []).filter(
      (o) => typeof o === "string" && /^https?:\/\//i.test(o),
    );
    return ["'self'", ...origins].join(" ");
  } catch {
    return "'self'";
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname: earlyPath } = request.nextUrl;

  // Public persona surfaces (Wave 2 Modes B/C) carry no auth and set a per-token
  // frame-ancestors CSP for embed loads. Handled before the auth pipeline and returned
  // early so the anonymous chat surface never triggers the subscription gate.
  if (earlyPath.startsWith("/public-persona/")) {
    const res = NextResponse.next({ request });
    const token = earlyPath.split("/")[2] ?? "";
    const isEmbed = request.nextUrl.searchParams.get("embed") === "1";
    const ancestors =
      isEmbed && token ? await frameAncestorsForToken(token) : "'self'";
    res.headers.set("Content-Security-Policy", `frame-ancestors ${ancestors}`);
    return res;
  }

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
  matcher: ["/app/:path*", "/api/app/:path*", "/public-persona/:path*"],
};
