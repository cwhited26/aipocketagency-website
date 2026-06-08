// connectors/stripe/oauth.ts — the Stripe Connect (Standard accounts) OAuth flow + config gate.
//
// Stripe Connect OAuth differs from Google/Slack: the platform authenticates the token exchange
// with its OWN secret key (STRIPE_SECRET_KEY — the same key PA's platform billing uses), and the
// authorize step needs the platform Connect application's client id (ca_…, surfaced in the Stripe
// Dashboard once Connect is enabled). Connected-account API calls then authenticate with the
// platform secret key + a Stripe-Account header (see ./api.ts), so there is no per-account access-
// token refresh dance — the stored Connect refresh token is kept for completeness, not used on
// every call. That is why this module has no ensureFreshToken(): a connection is usable until the
// owner deauthorizes, at which point a 401/403 flips it to reauth (./index.ts).
//
// Direct REST only — no Stripe SDK (Chase's standing rule). Token endpoints are plain fetch.

import { z } from "zod";
import { sendEmail } from "@/lib/resend";

// ─── Scope ──────────────────────────────────────────────────────────────────────
// Standard accounts: read_write is the only meaningful Connect OAuth scope (it grants the
// platform full API access to the connected account, gated downstream by PA's own approval
// middleware — Stripe's coarse scope is NOT the safety boundary; the approval Inbox is).
export const STRIPE_CONNECT_SCOPE = "read_write" as const;

const STRIPE_OAUTH_AUTHORIZE = "https://connect.stripe.com/oauth/authorize";
const STRIPE_OAUTH_TOKEN = "https://connect.stripe.com/oauth/token";
const STRIPE_OAUTH_DEAUTHORIZE = "https://connect.stripe.com/oauth/deauthorize";

// ─── Config gate ──────────────────────────────────────────────────────────────────
// Two values are required to drive the flow:
//   • clientSecret — STRIPE_SECRET_KEY: the platform secret key (reused from PA's existing Stripe
//     integration — no new secret to provision).
//   • clientId — STRIPE_CONNECT_CLIENT_ID: the platform's Connect application id (ca_…). This
//     value only EXISTS once Stripe Connect is enabled in the Dashboard; its absence is exactly
//     the "Connect not enabled yet" state, which the card surfaces as a clean empty state rather
//     than a crash.
export type StripeConnectConfig = { clientId: string; clientSecret: string };

export function stripeConnectConfig(): StripeConnectConfig | null {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const clientSecret = process.env.STRIPE_SECRET_KEY;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True iff Stripe Connect is enabled for this deployment (platform key + Connect client id). */
export function isStripeConnectConfigured(): boolean {
  return stripeConnectConfig() !== null;
}

/** The platform secret key used as the Bearer credential on connected-account API calls. */
export function platformSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

// ─── Redirect URI (single source of truth) ─────────────────────────────────────────
// Bit-exact match required between the authorize request and the token exchange, and it must be
// a registered redirect URI on the Connect application. Derived from PA_OAUTH_REDIRECT_BASE (the
// same env every other connector uses), never the request host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function stripeRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/stripe/callback`;
}

/** Build the Stripe Connect authorize URL. `state` is the signed CSRF token. */
export function buildStripeAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(STRIPE_OAUTH_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", STRIPE_CONNECT_SCOPE);
  url.searchParams.set("redirect_uri", stripeRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

// ─── Token exchange ─────────────────────────────────────────────────────────────────

export type StripeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

const TokenResponseSchema = z.object({
  stripe_user_id: z.string().min(1), // the connected account id (acct_…)
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  livemode: z.boolean().optional(),
  stripe_publishable_key: z.string().optional(),
  token_type: z.string().optional(),
});
export type StripeTokenResponse = z.infer<typeof TokenResponseSchema>;

function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

/** Exchange the OAuth authorization code for the connected account id + tokens. */
export async function exchangeCodeForTokens(
  code: string,
  config: StripeConnectConfig,
): Promise<StripeResult<StripeTokenResponse>> {
  const res = await fetch(STRIPE_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // client_secret is the platform secret key; redirect_uri must match the authorize request.
    body: new URLSearchParams({
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

async function parseTokenResponse(res: Response): Promise<StripeResult<StripeTokenResponse>> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "token endpoint returned non-JSON", authError: false };
  }
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "token response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Best-effort revoke of the platform's access to a connected account on disconnect. A failure is
 * non-fatal — the local row is soft-deleted regardless.
 */
export async function deauthorizeAccount(
  stripeAccountId: string,
  config: StripeConnectConfig,
): Promise<void> {
  try {
    await fetch(STRIPE_OAUTH_DEAUTHORIZE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_secret: config.clientSecret,
        client_id: config.clientId,
        stripe_user_id: stripeAccountId,
      }).toString(),
      cache: "no-store",
    });
  } catch {
    // Deauthorization is best-effort; the row is wiped regardless.
  }
}

// ─── Connected account display name ────────────────────────────────────────────────
// Fetched right after the grant so the Connections card can show a human business name (stored
// in the repurposed `email` column). Uses the platform key + Stripe-Account header — the same
// connected-account context every action uses. Best-effort: a failure returns null and the card
// falls back to the account id.

const AccountSchema = z.object({
  business_profile: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  settings: z
    .object({ dashboard: z.object({ display_name: z.string().nullable().optional() }).nullable().optional() })
    .nullable()
    .optional(),
  email: z.string().nullable().optional(),
});

export async function fetchAccountDisplayName(
  secretKey: string,
  accountId: string,
): Promise<string | null> {
  const res = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Account": accountId },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json().catch(() => null);
  const parsed = AccountSchema.safeParse(raw);
  if (!parsed.success) return null;
  return (
    parsed.data.business_profile?.name ??
    parsed.data.settings?.dashboard?.display_name ??
    parsed.data.email ??
    null
  );
}

// ─── Re-auth system email (roadmap §3.5 — shared Resend transport) ─────────────────
// Stripe is a revenue connector, so a dead connection is high-priority. Best-effort send: a
// transport failure (e.g. RESEND_API_KEY unset) is returned, never thrown, so a re-auth never
// crashes an action.

const REAUTH_FROM = "Pocket Agent <agent@aipocketagency.com>";

export async function notifyStripeReauthNeeded(ownerEmail: string | null): Promise<void> {
  if (!ownerEmail) return;
  const reconnectUrl = `${(process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "")}/app/settings/connections`;
  await sendEmail({
    from: REAUTH_FROM,
    to: ownerEmail,
    subject: "Reconnect Stripe to keep invoicing + refunds working",
    text:
      "Your Stripe connection stopped working — the account was disconnected or its access was revoked.\n\n" +
      `Reconnect it here to let your agent keep creating invoices and payment links: ${reconnectUrl}\n\n` +
      "Until you reconnect, Stripe actions stay paused. No money moves while it's disconnected.",
    html:
      `<p>Your Stripe connection stopped working — the account was disconnected or its access was revoked.</p>` +
      `<p><a href="${reconnectUrl}">Reconnect Stripe</a> to let your agent keep creating invoices and payment links.</p>` +
      `<p>Until you reconnect, Stripe actions stay paused. No money moves while it's disconnected.</p>`,
  });
}
