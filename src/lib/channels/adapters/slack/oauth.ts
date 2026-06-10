// lib/channels/adapters/slack/oauth.ts — the Channels Gateway's Slack install (OAuth v2).
//
// Distinct from the legacy Slack *Connection* (connectors/slack): this is the gateway's own install
// surface (/api/channels/slack/{install,callback}) with its own redirect URI and the channel scopes
// from SPEC §8.2. It reuses the shared, proven primitives in lib/slack.ts — the credential reader
// and the oauth.v2.access token exchange (the redirect URI is a parameter, so passing the gateway's
// own URI keeps the bit-exact match Slack requires).
//
// Phase-1 token model: a long-lived bot token (xoxb-…). The access_token from the install IS the
// durable secret the adapter sends with; no rotation/refresh in this lane.

import { exchangeCodeForTokens, slackOAuthCreds, type SlackOAuthAccess, type SlackResult } from "@/lib/slack";

// SPEC §8.2 scopes: read DMs + @mentions, read users, post replies.
export const CHANNEL_SLACK_SCOPES = [
  "chat:write",
  "im:history",
  "im:read",
  "users:read",
  "app_mentions:read",
] as const;

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The gateway's own OAuth callback URL. Bit-exact between authorize + token exchange. */
export function channelSlackRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/channels/slack/callback`;
}

/** Build the Slack authorize URL the install route redirects to. */
export function buildChannelSlackAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", CHANNEL_SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", channelSlackRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

/** Whether the Slack OAuth credentials are configured on this deployment. */
export function channelSlackOAuthConfigured(): boolean {
  return slackOAuthCreds() !== null;
}

/** Exchange the OAuth code for a bot token, using the gateway's redirect URI. */
export async function exchangeChannelSlackCode(
  code: string,
): Promise<SlackResult<SlackOAuthAccess>> {
  return exchangeCodeForTokens(code, channelSlackRedirectUri());
}
