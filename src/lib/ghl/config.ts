// config.ts — the GHL Connector's env + endpoint surface (GHL Agencies SPEC v1 §5). Pure readers,
// no I/O. Everything the OAuth flow, the API client, and the webhook receiver need to agree on
// lives here so the values can't drift between routes.
//
// GHL API 2.0: every endpoint call requires a `Version` header, and the version differs by API
// family (contacts vs conversations vs calendars) — the endpoint map below carries the right one
// per call so callers never hand-roll headers.

const DEFAULT_API_BASE = "https://services.leadconnectorhq.com";
const DEFAULT_AUTHORIZE_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";

// API-family version headers (GHL API 2.0 requirement; values from the published API docs).
export const GHL_VERSION_LOCATIONS = "2021-07-28";
export const GHL_VERSION_CONTACTS = "2021-07-28";
export const GHL_VERSION_CONVERSATIONS = "2021-04-15";
export const GHL_VERSION_CALENDARS = "2021-04-15";

/**
 * Ship 2 scope set (SPEC §5 lock, minimal cut per the Ship 2 brief). The write scopes cover the
 * three v1 write actions; the readonly scopes cover the three v1 reads + location discovery.
 * Ship 5 widens this list as the remaining Apps land.
 */
export const GHL_OAUTH_SCOPES = [
  "locations.readonly",
  "contacts.readonly",
  "contacts.write",
  "conversations.readonly",
  "conversations.write",
  "conversations/message.readonly",
  "conversations/message.write",
  "calendars.readonly",
  "calendars.write",
  "calendars/events.readonly",
  "calendars/events.write",
  "campaigns.readonly",
  "opportunities.readonly",
  "workflows.readonly",
] as const;

export function ghlApiBase(): string {
  return (process.env.GHL_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function ghlAuthorizeBase(): string {
  return process.env.GHL_OAUTH_AUTHORIZE_URL ?? DEFAULT_AUTHORIZE_URL;
}

export type GhlOauthCreds = { clientId: string; clientSecret: string };

/** Marketplace app credentials, or null until Chase registers the app + sets the env pair. */
export function ghlOauthCreds(): GhlOauthCreds | null {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// Same rule as gmailRedirectUri(): NEVER derive from the request host — the prod deploy also
// answers on app.* and *.vercel.app aliases that aren't registered on the Marketplace app.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The OAuth callback URL, bit-exact on the authorize request and the token exchange. */
export function ghlRedirectUri(): string {
  const explicit = process.env.GHL_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/integrations/ghl/callback`;
}
