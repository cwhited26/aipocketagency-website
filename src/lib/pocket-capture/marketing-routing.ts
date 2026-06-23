// Pocket Capture standalone marketing surface (PC-MARK-1).
//
// The product lives at its own subdomain — `capture.aipocketagent.com` (PA-CAPTURE-1).
// Rather than a second domain, v1 routes that host into an isolated route group inside
// the existing PA Next.js app. Middleware reads the request host and rewrites the marketing
// page paths (`/`, `/privacy`, `/terms`) onto the internal `/pocket-capture` segment that
// the `(pocket-capture-marketing)` route group serves.
//
// Everything that is NOT a marketing page on that host passes through untouched: the API
// (checkout POSTs to `/api/pocket-capture/checkout`), Next internals, static files, and the
// PWA share-target route `/capture/share` (PC-CORE-1). Keeping the logic here as pure
// functions makes it unit-testable without booting the edge runtime.

/** Internal segment the `(pocket-capture-marketing)` route group is mounted under. */
export const POCKET_CAPTURE_SEGMENT = "/pocket-capture";

/** Canonical public host for the standalone product (PA-CAPTURE-1). */
export const POCKET_CAPTURE_HOST = "capture.aipocketagent.com";

/**
 * True when a request host belongs to the Pocket Capture marketing subdomain.
 * Strips any port so it also matches `capture.localhost:3000` in local dev.
 */
export function isPocketCaptureHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.toLowerCase().split(":")[0];
  if (bare === POCKET_CAPTURE_HOST) return true;
  // Local-dev convenience: `capture.localhost` resolves to 127.0.0.1 in most setups.
  return bare === "capture.localhost" || bare.endsWith(".capture.localhost");
}

// Path prefixes that must reach their real handlers on the capture host instead of the
// marketing route group. `/api` carries the checkout POST; `/capture` is the share target;
// `/pocket-capture` is the rewrite destination itself (guard against a rewrite loop).
const PASS_THROUGH_PREFIXES = [
  "/api",
  "/_next",
  "/capture",
  "/app",
  POCKET_CAPTURE_SEGMENT,
];

/**
 * Maps an incoming pathname on the capture host to the internal route-group path it should
 * render. Returns `null` when the request should pass through to its normal handler (API,
 * static asset, share target, already-prefixed path).
 */
export function pocketCaptureTargetPath(pathname: string): string | null {
  if (PASS_THROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }
  // Static files in /public (favicon, icons, manifest, og images) keep their real path.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return null;

  if (pathname === "/") return POCKET_CAPTURE_SEGMENT;
  return `${POCKET_CAPTURE_SEGMENT}${pathname}`;
}
