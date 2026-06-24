// Cross-subdomain auth cookie scoping for `aipocketagent.com` and `app.aipocketagent.com`.
//
// So a session created on `aipocketagent.com/app/captures` is also visible on
// `app.aipocketagent.com/captures`, the Supabase auth cookies must be scoped to the
// parent domain (`.aipocketagent.com`, leading dot) rather than host-only.
//
// This is gated: only in production AND when the request host is under
// `aipocketagent.com`. In dev (localhost) and on Vercel preview URLs we leave cookies
// host-scoped, so those environments keep working unchanged.

import { ROOT_DOMAIN } from "./routing";

// Returns the cookie `domain` to set for cross-subdomain auth, or `undefined` to leave
// the cookie host-scoped (the default). When defined, the value carries a leading dot so
// the cookie is shared across the apex and every `*.aipocketagent.com` subdomain.
export function crossSubdomainCookieDomain(
  host: string | null,
  nodeEnv: string | undefined,
): string | undefined {
  if (nodeEnv !== "production") return undefined;
  if (!host) return undefined;
  const h = host.toLowerCase().split(":")[0] ?? "";
  if (h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`)) {
    return `.${ROOT_DOMAIN}`;
  }
  return undefined;
}
