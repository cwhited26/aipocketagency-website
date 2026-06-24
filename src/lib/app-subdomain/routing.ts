// Host-aware routing for the clean SaaS subdomain `app.aipocketagent.com`.
//
// The Pocket Agent app lives under the `/app/*` segment on the apex
// (`aipocketagent.com/app/captures`). This module lets the same routes be served
// from `app.aipocketagent.com/captures` — without the redundant `/app/` segment in
// the URL bar — via an internal `NextResponse.rewrite()` in middleware. The apex
// keeps working exactly as before; this only adds behavior for the subdomain host.
//
// Pure functions only (no Next.js imports) so the gating is unit-testable and the
// middleware stays a thin adapter over these decisions.

export const ROOT_DOMAIN = "aipocketagent.com";
export const APEX_HOST = ROOT_DOMAIN;
export const APP_SUBDOMAIN_HOST = `app.${ROOT_DOMAIN}`;

// Marketing/funnel paths that exist ONLY on the apex (no `/app/*` counterpart). On the
// app subdomain these are not part of the app surface, so we 301 them back to the apex
// to keep `app.*` strictly for the app. Matched on the first path segment.
//
// NOTE: `launch-kit` and `setup` are deliberately omitted — the app has `/app/launch-kit`
// and `/app/setup-sprint`, so on the subdomain those names must resolve to the app
// surface (rewrite), not redirect to apex marketing.
const APEX_ONLY_SEGMENTS = new Set<string>([
  "pricing",
  "start",
  "enterprise",
  "upsell",
  "downsell",
  "downsell-kit",
  "thanks",
  "training",
  "training-confirmed",
  "replay",
]);

function hostname(host: string | null): string | null {
  if (!host) return null;
  // Strip any port and lower-case (Host headers can carry a port and arbitrary case).
  return host.toLowerCase().split(":")[0] ?? null;
}

export function isAppSubdomain(host: string | null): boolean {
  return hostname(host) === APP_SUBDOMAIN_HOST;
}

export function isApexHost(host: string | null): boolean {
  return hostname(host) === APEX_HOST;
}

export type SubdomainRoute =
  // Already a real app/API path (or a static file) — serve as-is, no rewrite.
  | { kind: "passthrough" }
  // Apex-only marketing path — 301 back to the apex host.
  | { kind: "redirect-apex" }
  // App surface — internally rewrite `/captures` → `/app/captures`.
  | { kind: "rewrite"; internalPath: string };

// Decides what to do with a request that arrived on `app.aipocketagent.com`.
// `pathname` is the incoming path as seen by the browser (no `/app/` prefix expected).
export function routeForAppSubdomain(pathname: string): SubdomainRoute {
  // Already the canonical internal app path (legacy / shouldn't happen on the subdomain
  // but is safe) — pass through untouched.
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return { kind: "passthrough" };
  }

  // API routes are real routes at their own path — never rewrite them.
  if (pathname.startsWith("/api/")) {
    return { kind: "passthrough" };
  }

  // Static files (manifest, icons, robots, etc.) live at the root and must not be
  // rewritten into `/app/*`. Detect by a file extension on the final segment.
  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    return { kind: "passthrough" };
  }

  // Root and apex-only marketing funnel paths belong on the apex.
  const firstSegment = pathname.split("/")[1] ?? "";
  if (pathname === "/" || APEX_ONLY_SEGMENTS.has(firstSegment)) {
    return { kind: "redirect-apex" };
  }

  // Everything else is the app surface: `app.*/captures` → internal `/app/captures`.
  return { kind: "rewrite", internalPath: `/app${pathname}` };
}
