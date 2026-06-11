// lib/connectors/slack/oauth.ts — the Slack OAuth flow + token lifecycle for the Connection.
//
// Wraps the transport in lib/slack.ts with the connector-level concerns: the requested scope
// set, the authorize URL, and ensureFreshSlackToken() — the "is the stored token usable, else
// refresh" decision that every write/read action calls before it touches the Web API.
//
// Token model (two installs, one code path):
//   • Long-lived bot token — the default. The xoxb-… token is stored encrypted in
//     refresh_token_encrypted; ensureFreshSlackToken just decrypts it. No expiry, no refresh.
//   • Rotating token — when the Slack app has token rotation enabled, oauth.v2.access returns
//     refresh_token + expires_in. The refresh token is stored encrypted; the short-lived bot
//     token is cached on access_token with its expiry and refreshed near expiry (like Gmail).
//
// Re-auth (roadmap §3.5): on a hard auth failure the connection flips to status='error' and
// notifySlackReauthNeeded() fires a system email via the shared Resend transport (lib/resend.ts).

import { decrypt, encrypt } from "@/lib/crypto/encrypt";
import { sendEmail } from "@/lib/resend";
import {
  type SlackResult,
  refreshAccessToken,
  slackOAuthCreds,
  slackRedirectUri,
} from "@/lib/slack";
import {
  type SlackConnectionFull,
  updateSlackAccessToken,
  updateSlackRefreshToken,
} from "@/lib/pa-slack-connections";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// Bot-token model (Slack's recommended model for an app that posts + reads). The reads cover
// channel listing + history for drafting replies and user lookup for DMs; the writes cover
// channel posts, threaded replies, and opening a DM. Union of the roadmap mini-spec and the
// lane brief's required minimum — adding scopes is safe, dropping a required one is not.
//   reads:  channels:read, channels:history, groups:read, groups:history, im:read, im:history,
//           users:read, app_mentions:read (receive @mentions on the inbound webhook)
//   writes: chat:write, chat:write.public (post to public channels w/o joining),
//           chat:write.customize (custom username/icon), im:write (open a DM channel)
//
// Inbound DM (PA-SLACK-DM-1) rides on three of these: `im:history` (receive `message.im`
// events when the owner DMs the bot), `app_mentions:read` (receive `app_mention` events when
// they @mention it in a channel), and `chat:write`/`im:write` to post the reply back. Existing
// connections predate `app_mentions:read`, so the owner must reconnect once to grant it before
// channel @mentions reach the webhook.
export const SLACK_BOT_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "users:read",
  "app_mentions:read",
  "chat:write",
  "chat:write.public",
  "chat:write.customize",
  "im:write",
] as const;

/** True iff Slack OAuth is configured in this deployment (client id + secret on Vercel). */
export function isSlackOAuthConfigured(): boolean {
  return slackOAuthCreds() !== null;
}

/** Build the Slack authorize URL. `state` is the signed CSRF token. */
export function buildSlackAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SLACK_BOT_SCOPES.join(","));
  url.searchParams.set("redirect_uri", slackRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

// ─── Token freshness ────────────────────────────────────────────────────────────

/**
 * Return a usable bot token for a connection. For a long-lived install (no cached access
 * token / expiry) this decrypts the stored bot token. For a rotation install it returns the
 * cached token when still valid, else refreshes, persisting the new access + refresh tokens.
 * Skews 60s early so an in-flight action never trips on expiry mid-request.
 */
export async function ensureFreshSlackToken(
  conn: SlackConnectionFull,
): Promise<SlackResult<string>> {
  if (!conn.refresh_token_encrypted) {
    return { ok: false, status: 401, error: "no_token", authError: true };
  }

  let durableSecret: string;
  try {
    durableSecret = decrypt(conn.refresh_token_encrypted);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "decrypt_failed",
      authError: false,
    };
  }

  // Long-lived bot token: the durable secret IS the access token. No expiry, no refresh.
  if (!conn.access_token_expires_at) {
    return { ok: true, data: durableSecret };
  }

  // Rotation install: serve the cached token while valid.
  const now = Date.now();
  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  // Refresh. durableSecret is the refresh token in this branch.
  const refreshed = await refreshAccessToken(durableSecret);
  if (!refreshed.ok) return refreshed;

  const data = refreshed.data;
  if (!data.expires_in) {
    return { ok: false, status: 502, error: "refresh response missing expires_in", authError: false };
  }
  const newExpiry = new Date(now + data.expires_in * 1000).toISOString();
  await updateSlackAccessToken(conn.id, data.access_token, newExpiry);
  // Slack rotation issues a fresh refresh token on every refresh — persist it or the next
  // refresh fails.
  if (data.refresh_token) {
    await updateSlackRefreshToken(conn.id, encrypt(data.refresh_token));
  }
  return { ok: true, data: data.access_token };
}

// ─── Re-auth system email (roadmap §3.5 — shared Resend transport) ──────────────

const REAUTH_FROM = "Pocket Agent <agent@aipocketagent.com>";

/**
 * Notify the owner that Slack disconnected and needs a reconnect. Best-effort: a transport
 * failure (e.g. RESEND_API_KEY unset) is returned, never thrown, so a re-auth never crashes an
 * action. The inline Connections card is the primary signal; this email is the nudge.
 */
export async function notifySlackReauthNeeded(ownerEmail: string | null): Promise<void> {
  if (!ownerEmail) return;
  const reconnectUrl = `${(process.env.PA_OAUTH_REDIRECT_BASE ?? "https://aipocketagent.com").replace(/\/+$/, "")}/app/settings/connections`;
  await sendEmail({
    from: REAUTH_FROM,
    to: ownerEmail,
    subject: "Reconnect Slack to keep your agent posting",
    text:
      "Your Slack connection stopped working — the workspace token was revoked or expired.\n\n" +
      `Reconnect it here to let your agent keep posting and replying: ${reconnectUrl}\n\n` +
      "Until you reconnect, Slack actions stay paused.",
    html:
      `<p>Your Slack connection stopped working — the workspace token was revoked or expired.</p>` +
      `<p><a href="${reconnectUrl}">Reconnect Slack</a> to let your agent keep posting and replying.</p>` +
      `<p>Until you reconnect, Slack actions stay paused.</p>`,
  });
}
