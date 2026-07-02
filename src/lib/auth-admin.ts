// lib/auth-admin.ts — Supabase GoTrue admin helpers (service-role) for the pay-first signup path.
// pocket_agent_users has no email column and the app never stored passwords, so account lifecycle
// lives entirely in Supabase auth. This module is the thin, Zod-validated REST layer the Stripe
// webhook and the orphaned-signup cron use to: resolve-or-create the buyer's auth user by email,
// and read whether that user has ever signed in. No console.log — diagnostics go through callers.

import { z } from "zod";

function authEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

// GoTrue admin responses we read. Kept permissive (.passthrough via loose object) — we only assert
// the fields we consume so a schema drift on unrelated fields never breaks the webhook.
const AdminUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable().optional(),
  last_sign_in_at: z.string().nullable().optional(),
});
type AdminUser = z.infer<typeof AdminUserSchema>;

// generate_link nests the user under `user`; createUser returns the user at the top level.
const GenerateLinkSchema = z.object({ user: AdminUserSchema });

export type ResolvedUser = {
  userId: string;
  // true only when THIS call created the account — the signal the webhook uses to decide
  // "new pay-first signup" vs "existing account paid" (free-then-pay or a repeat purchase).
  wasCreated: boolean;
};

type ResolveResult =
  | { ok: true; user: ResolvedUser }
  | { ok: false; status: number; error: string };

function adminHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// Probe an existing user's id by email via generate_link. Only called on the create-conflict branch
// (the user already exists), where generate_link reliably returns the user object. We discard the
// action link — the login email is sent separately through the proven signInWithOtp (PKCE) flow so
// its callback format matches /app/auth/callback.
async function probeUserIdByEmail(
  env: { url: string; key: string },
  email: string,
): Promise<ResolveResult> {
  let res: Response;
  try {
    res = await fetch(`${env.url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders(env.key),
      body: JSON.stringify({ type: "magiclink", email }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const parsed = GenerateLinkSchema.safeParse(await res.json());
  if (!parsed.success) {
    return { ok: false, status: 502, error: `generate_link parse failed: ${parsed.error.message}` };
  }
  return { ok: true, user: { userId: parsed.data.user.id, wasCreated: false } };
}

/**
 * Resolve the buyer's Supabase auth user for `email`, creating it if absent.
 *
 * Create-first, probe-on-conflict: admin createUser deterministically creates a new user (returns
 * its id, wasCreated=true) or 422s "email exists" (we then probe the id, wasCreated=false). The new
 * user is created email-confirmed and password-less — they never chose a password, and requiring an
 * email round-trip before their first magic-link login would defeat the whole low-friction point.
 * `anonymous_signup` is stamped into user_metadata for later analytics.
 *
 * Idempotent across webhook retries: a retry hits the 422 branch and returns the same id with
 * wasCreated=false, so the "new signup" side effects (seed + login email) never double-fire.
 */
export async function resolveOrCreatePocketAgentUser(
  email: string,
): Promise<ResolveResult> {
  const env = authEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders(env.key),
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: { anonymous_signup: true },
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }

  if (res.ok) {
    const parsed = AdminUserSchema.safeParse(await res.json());
    if (!parsed.success) {
      return { ok: false, status: 502, error: `createUser parse failed: ${parsed.error.message}` };
    }
    return { ok: true, user: { userId: parsed.data.id, wasCreated: true } };
  }

  // 422 (email already registered) is the expected "user exists" signal — resolve their id instead
  // of treating it as a failure. Any other status is a real error.
  if (res.status === 422 || res.status === 409) {
    return probeUserIdByEmail(env, email);
  }
  return { ok: false, status: res.status, error: await res.text() };
}

type FetchUserResult =
  | { ok: true; user: AdminUser | null }
  | { ok: false; status: number; error: string };

/** Read an auth user by id — the orphaned-signup cron uses last_sign_in_at to find buyers who paid
 *  but never logged in. Returns `user: null` on 404. */
export async function fetchAuthUserById(userId: string): Promise<FetchUserResult> {
  const env = authEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (res.status === 404) return { ok: true, user: null };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

  const parsed = AdminUserSchema.safeParse(await res.json());
  if (!parsed.success) {
    return { ok: false, status: 502, error: `admin user parse failed: ${parsed.error.message}` };
  }
  return { ok: true, user: parsed.data };
}
