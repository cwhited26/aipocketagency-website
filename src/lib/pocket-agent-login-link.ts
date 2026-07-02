// lib/pocket-agent-login-link.ts — send a Pocket Agent login (magic) link.
//
// The pay-first flow needs a buyer with no password to get into their workspace. We send the link
// through Supabase's signInWithOtp (PKCE) rather than admin generate_link because signInWithOtp
// produces the `?code=` callback shape that /app/auth/callback already exchanges — the proven path
// the existing /app/login form uses. The trade-off is the email body is Supabase's Auth template,
// not our Resend layout; branding that template is a dashboard config task, not a code change.
//
// Reused by: the Stripe webhook (on account creation), the /thanks resend button, and the
// orphaned-signup cron.

import { createClient } from "@supabase/supabase-js";

// Where the magic link drops the buyer after the callback exchanges their code for a session.
export const LOGIN_LINK_NEXT = "/app/home";

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aipocketagent.com").replace(/\/$/, "");
}

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Email `email` a magic link that logs them straight into their workspace. Headless (no cookies) —
 * safe to call from a webhook, cron, or route. `shouldCreateUser` stays on so a buyer whose account
 * hasn't landed yet (webhook race) still gets a working link; on an existing user it just sends.
 */
export async function sendPocketAgentLoginLink(email: string): Promise<SendResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set" };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const emailRedirectTo = `${siteOrigin()}/app/auth/callback?next=${encodeURIComponent(
    LOGIN_LINK_NEXT,
  )}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
