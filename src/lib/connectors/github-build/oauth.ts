// connectors/github-build/oauth.ts — the GitHub OAuth App flow + config gate for the Build
// connector.
//
// GitHub OAuth App tokens (the scopes-based flow, as opposed to GitHub App installation tokens) do
// NOT expire and carry no refresh token — the grant is valid until the owner revokes it in their
// GitHub settings, at which point a 401/403 flips the connection to reauth (./actions.ts). That is
// why this module has no ensureFreshToken(): the stored access token is used directly on every
// call. It is the most powerful credential PA holds, so it is stored AES-256-GCM encrypted at rest
// (lib/crypto/encrypt.ts), never plaintext.
//
// Direct REST only — no Octokit SDK (Chase's standing rule). Token endpoints are plain fetch.

import { z } from "zod";

// ─── Scope ──────────────────────────────────────────────────────────────────────
// repo        — create/read/write across the owner's repos (the load-bearing scope).
// workflow    — write CI workflow files under .github/workflows (a scaffold needs this to push a
//               build pipeline alongside the code).
// delete_repo — cleanup of a failed scaffold. The hardest-gated capability; never used by an
//               untrusted-origin sub-agent (Build Tools SPEC §11.3).
// GitHub coarse scopes are NOT the safety boundary — the approval Inbox is. Every write still
// stages for the owner's tap.
export const GITHUB_BUILD_SCOPES = ["repo", "workflow", "delete_repo"] as const;
export const GITHUB_BUILD_SCOPE_STRING = GITHUB_BUILD_SCOPES.join(" ");

const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API_USER = "https://api.github.com/user";

// ─── Config gate ──────────────────────────────────────────────────────────────────
// Two values drive the flow, both provisioned when Chase registers the OAuth App in GitHub:
//   • GITHUB_BUILD_OAUTH_CLIENT_ID
//   • GITHUB_BUILD_OAUTH_CLIENT_SECRET
// Their absence is the "GitHub Build not enabled yet" state, which the card surfaces as a clean
// empty state rather than a crash — exactly like the Stripe Connect / Slack config gates.
export type GithubBuildConfig = { clientId: string; clientSecret: string };

export function githubBuildConfig(): GithubBuildConfig | null {
  const clientId = process.env.GITHUB_BUILD_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_BUILD_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True iff the GitHub Build OAuth App is configured for this deployment. */
export function isGithubBuildOAuthConfigured(): boolean {
  return githubBuildConfig() !== null;
}

// ─── Redirect URI (single source of truth) ─────────────────────────────────────────
// Must match the callback URL registered on the OAuth App. Derived from PA_OAUTH_REDIRECT_BASE
// (the same env every other connector uses), never the request host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function githubBuildRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connectors/github-build/callback`;
}

/** Build the GitHub authorize URL. `state` is the signed CSRF token. */
export function buildGithubBuildAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(GITHUB_OAUTH_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", githubBuildRedirectUri());
  url.searchParams.set("scope", GITHUB_BUILD_SCOPE_STRING);
  url.searchParams.set("state", state);
  // Force the account chooser so an owner can pick which GitHub identity to connect.
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

// ─── Token exchange ─────────────────────────────────────────────────────────────────

export type GithubResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type GithubTokenResponse = z.infer<typeof TokenResponseSchema>;

// GitHub returns 200 with an `error` field (not a 4xx) when the code is bad/expired.
const TokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

/** Exchange the OAuth authorization code for the access token. */
export async function exchangeCodeForToken(
  code: string,
  config: GithubBuildConfig,
): Promise<GithubResult<GithubTokenResponse>> {
  const res = await fetch(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: githubBuildRedirectUri(),
    }).toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: res.status === 401 };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "token endpoint returned non-JSON", authError: false };
  }
  const err = TokenErrorSchema.safeParse(raw);
  if (err.success) {
    return {
      ok: false,
      status: 400,
      error: err.data.error_description ?? err.data.error,
      authError: err.data.error === "bad_verification_code",
    };
  }
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "token response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

// ─── Connected account login ────────────────────────────────────────────────────────
// Fetched right after the grant so the Connections card can show the GitHub handle and the
// connector can resolve the owner for "name"-only repo references. Stored in the repurposed
// `email` column (pa_connections has no provider-metadata column — same repurpose Slack/Stripe use).

const GithubUserSchema = z.object({ login: z.string().min(1) });

export async function fetchGithubLogin(accessToken: string): Promise<string | null> {
  const res = await fetch(GITHUB_API_USER, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PocketAgent",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json().catch(() => null);
  const parsed = GithubUserSchema.safeParse(raw);
  return parsed.success ? parsed.data.login : null;
}
