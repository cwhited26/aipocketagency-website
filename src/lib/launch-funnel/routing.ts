// Launch funnel standalone marketing surface.
//
// The funnel lives at its own subdomain — `start.aipocketagent.com`. Rather than a second
// project, it routes that host into an isolated route group inside the existing PA Next.js app
// (the same pattern as Pocket Capture / the app subdomain). Middleware reads the request host
// and rewrites the funnel page paths (`/`, `/q/[step]`, `/start`, `/success`) onto the internal
// `/launch` segment that the `(launch-funnel)` route group serves.
//
// Everything that is NOT a funnel page on that host passes through untouched: the API (the
// checkout POST hits `/api/pocket-agent/checkout`), Next internals, static files, and any `/app`
// path. Keeping the logic here as pure functions makes it unit-testable without the edge runtime.

/** Internal segment the `(launch-funnel)` route group is mounted under. */
export const LAUNCH_FUNNEL_SEGMENT = "/launch";

/** Canonical public host for the launch funnel. */
export const LAUNCH_FUNNEL_HOST = "start.aipocketagent.com";

/**
 * True when a request host belongs to the launch funnel subdomain. Strips any port so it also
 * matches `start.localhost:3000` in local dev.
 */
export function isLaunchFunnelHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.toLowerCase().split(":")[0];
  if (bare === LAUNCH_FUNNEL_HOST) return true;
  // Local-dev convenience: `start.localhost` resolves to 127.0.0.1 in most setups.
  return bare === "start.localhost" || bare.endsWith(".start.localhost");
}

// Path prefixes that must reach their real handlers on the funnel host instead of the route
// group. `/api` carries the checkout POST; `/app` is the SaaS surface; `/launch` is the rewrite
// destination itself (guard against a rewrite loop).
const PASS_THROUGH_PREFIXES = [
  "/api",
  "/_next",
  "/app",
  LAUNCH_FUNNEL_SEGMENT,
];

/**
 * Maps an incoming pathname on the funnel host to the internal route-group path it should render.
 * Returns `null` when the request should pass through to its normal handler (API, static asset,
 * already-prefixed path). The funnel's public URLs stay clean — `start.aipocketagent.com/q/1`
 * renders the internal `/launch/q/1`.
 */
export function launchFunnelTargetPath(pathname: string): string | null {
  if (
    PASS_THROUGH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return null;
  }
  // Static files in /public (favicon, icons, manifest, og images) keep their real path.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return null;

  if (pathname === "/") return LAUNCH_FUNNEL_SEGMENT;
  return `${LAUNCH_FUNNEL_SEGMENT}${pathname}`;
}
