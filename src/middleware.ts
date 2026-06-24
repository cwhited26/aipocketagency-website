import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  isPocketCaptureHost,
  pocketCaptureTargetPath,
} from "@/lib/pocket-capture/marketing-routing";
import { crossSubdomainCookieDomain } from "@/lib/app-subdomain/cookies";
import {
  APEX_HOST,
  isAppSubdomain,
  routeForAppSubdomain,
} from "@/lib/app-subdomain/routing";

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

  // Pocket Capture standalone marketing subdomain (PC-MARK-1). On capture.aipocketagent.com,
  // rewrite the marketing page paths onto the isolated `(pocket-capture-marketing)` route
  // group; the API (checkout), the share-target route, and static files pass through. This
  // runs before the auth pipeline so the public landing never triggers the subscription gate.
  if (isPocketCaptureHost(request.headers.get("host"))) {
    const target = pocketCaptureTargetPath(earlyPath);
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next({ request });
  }

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

  const host = request.headers.get("host");

  // Clean SaaS subdomain (app.aipocketagent.com). The app surface also lives here without
  // the redundant `/app/` segment in the URL bar — `app.*/captures` is internally rewritten
  // to `/app/captures`. Apex-only marketing paths 301 back to the apex; paths already under
  // `/app`, API routes, and static files pass through. The apex (aipocketagent.com) is
  // unaffected — this only adds behavior for the subdomain host.
  const onAppSubdomain = isAppSubdomain(host);
  let rewriteUrl: URL | null = null;
  // The internal path the auth pipeline gates on (after any subdomain rewrite). On the apex
  // it is just the request path; on the subdomain a `/captures` request gates as `/app/captures`.
  let internalPath = earlyPath;
  if (onAppSubdomain) {
    const route = routeForAppSubdomain(earlyPath);
    if (route.kind === "redirect-apex") {
      const target = request.nextUrl.clone();
      target.protocol = "https:";
      target.host = APEX_HOST;
      return NextResponse.redirect(target, 301);
    }
    if (route.kind === "rewrite") {
      rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = route.internalPath;
      internalPath = route.internalPath;
    }
  }

  // TODO: Enable once app.aipocketagent.com is verified live in Vercel + Cloudflare DNS is
  // propagated. Toggling makes the subdomain canonical — apex `/app/*` traffic will 301 to
  // the clean subdomain URL. Shipped ready-to-flip but disabled so existing apex bookmarks
  // are not broken before the subdomain is serving. Self-contained: uncomment to enable.
  // const onApex = (host?.toLowerCase().split(":")[0] ?? "") === APEX_HOST;
  // if (onApex && (earlyPath === "/app" || earlyPath.startsWith("/app/"))) {
  //   const target = request.nextUrl.clone();
  //   target.protocol = "https:";
  //   target.host = `app.${APEX_HOST}`;
  //   target.pathname = earlyPath.replace(/^\/app/, "") || "/";
  //   return NextResponse.redirect(target, 301);
  // }

  // Builds the "allow" response: a rewrite to the internal `/app/*` path on the subdomain,
  // otherwise a normal pass-through. Re-invoked by setAll so refreshed cookies land on it.
  const buildResponse = (): NextResponse =>
    rewriteUrl
      ? NextResponse.rewrite(rewriteUrl, { request })
      : NextResponse.next({ request });

  // Share the Supabase auth cookies across the apex and the app subdomain in production
  // (`.aipocketagent.com`). In dev / preview this is undefined → cookies stay host-scoped.
  const cookieDomain = crossSubdomainCookieDomain(host, process.env.NODE_ENV);
  const withDomain = (options: Record<string, unknown> | undefined) =>
    cookieDomain ? { ...options, domain: cookieDomain } : options;

  let supabaseResponse = buildResponse();

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
          supabaseResponse = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, withDomain(options)),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAppPath =
    internalPath.startsWith("/app") || internalPath.startsWith("/api/app");
  if (!isAppPath) return supabaseResponse;
  if (isPublicAppPath(internalPath)) return supabaseResponse;

  if (!user) {
    // On the subdomain redirect to the clean `/login` (which itself rewrites to /app/login),
    // so the URL bar stays free of the `/app/` segment.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = onAppSubdomain ? "/login" : "/app/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const hasSubscription = await checkSubscription(user.id, user.email ?? null);
  if (!hasSubscription) {
    // The expired/upsell page lives on the apex marketing surface, not the app subdomain.
    const expiredUrl = onAppSubdomain
      ? new URL(`https://${APEX_HOST}/pocket-agent?expired=true`)
      : new URL("/pocket-agent?expired=true", request.url);
    return NextResponse.redirect(expiredUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/api/app/:path*",
    "/public-persona/:path*",
    // Pocket Capture marketing host: run middleware on its page paths so they can be
    // rewritten into the route group. Scoped by host so the main site is untouched; API
    // and static-asset paths are excluded here and re-checked in pocketCaptureTargetPath.
    {
      source: "/((?!api|_next|.*\\.).*)",
      has: [{ type: "host", value: "capture.aipocketagent.com" }],
    },
    // App subdomain (app.aipocketagent.com): run middleware on ALL its paths so bare app
    // paths (`/captures`) can be rewritten to `/app/captures`. Scoped by host so the apex is
    // untouched. `_next` internals are excluded; the rest is re-classified in
    // routeForAppSubdomain (API and static files pass through, marketing 301s to apex).
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "host", value: "app.aipocketagent.com" }],
    },
  ],
};
