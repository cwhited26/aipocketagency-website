// domains.ts — pure URL → host helpers shared by the refuse list, the Trust Ladder, and the
// per-domain permission lookups. Kept deliberately small and dependency-free so it's exhaustively
// unit-tested without a browser or network.

/**
 * Parse a URL and return its lowercased hostname, or null when the input isn't a parseable
 * absolute http/https URL. We refuse anything that isn't http(s) up front — a `file://` or
 * `chrome://` target has no place in a hosted scraping tool and must never reach the browser.
 */
export function hostOf(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  return host.length > 0 ? host : null;
}

/**
 * The registrable domain for a host, used as the Trust-Ladder + permissions key so
 * `app.quickbooks.com` and `quickbooks.com` share one trust bucket. This is a pragmatic
 * last-two-labels reduction (no public-suffix list dependency): it collapses common multipart
 * TLDs (co.uk, com.au, co.jp, …) to their last THREE labels so `foo.co.uk` stays `foo.co.uk`,
 * not `co.uk`. Good enough for the allow/deny + trust-count use; the full action log keeps the
 * exact host regardless.
 */
const MULTIPART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "co.jp",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "co.za",
  "com.mx",
]);

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  if (MULTIPART_TLDS.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

/** Convenience: the registrable domain straight from a URL, or null when unparseable. */
export function domainOf(rawUrl: string): string | null {
  const host = hostOf(rawUrl);
  return host ? registrableDomain(host) : null;
}

/**
 * True iff `host` is `suffix` or a subdomain of it. Case-insensitive, label-boundary aware
 * (so `notopenai.com` does NOT match `openai.com`). Used by the refuse list's wildcard domains.
 */
export function hostMatchesSuffix(host: string, suffix: string): boolean {
  const h = host.toLowerCase();
  const s = suffix.toLowerCase();
  return h === s || h.endsWith(`.${s}`);
}
