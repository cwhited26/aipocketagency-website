/**
 * Gmail REST client for Connections v1 — direct fetch, no googleapis SDK.
 * Every response is validated with Zod at the boundary.
 *
 * Token lifecycle: refresh tokens are stored encrypted (lib/crypto/encrypt.ts);
 * access tokens are cached on the pa_connections row with their expiry so the
 * 5-minute cron only refreshes when needed. ensureFreshAccessToken() encapsulates
 * the "is the cached token still good, else refresh + persist" decision.
 */
import { z } from "zod";
import { decrypt } from "@/lib/crypto/encrypt";
import {
  updateGmailAccessToken,
  type GmailConnectionFull,
} from "@/lib/pa-gmail-connections";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// readonly: read message/thread content. modify + labels: archive (remove the
// INBOX label) on a triage action. send: send a reply AS the user, threaded into
// the original conversation, landing in their Sent folder (connector.gmail.send).
// gmail.send is incrementally authorized — a user connected before this scope
// existed is prompted to re-grant the first time a send action fires. The OAuth
// start route requests this list with prompt=consent + include_granted_scopes, so
// a reconnect re-grants the new scope without dropping the old ones.
export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.send",
];

// The send scope, named once so the connector action, the approval route, and the
// Connections UI agree on what "send AS you" requires.
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** True iff a connection's granted scopes include gmail.send. */
export function hasGmailSendScope(scopes: readonly string[] | null): boolean {
  return Array.isArray(scopes) && scopes.includes(GMAIL_SEND_SCOPE);
}

export type GmailResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

// ─── OAuth redirect_uri (single source of truth) ───────────────────────────────
// Google rejects the flow with "Error 400: redirect_uri_mismatch" unless the
// redirect_uri on the auth request (start route) and the token exchange (callback
// route) are a bit-exact match for an Authorized redirect URI in the GCP OAuth
// client. NEVER derive this from the request host: the prod deploy also answers on
// the apex domain and *.vercel.app aliases, none of which are registered. Both
// routes call gmailRedirectUri() so the value is identical on each call.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://app.aipocketagency.com";

/**
 * The OAuth callback URL, built verbatim from PA_OAUTH_REDIRECT_BASE (read at
 * request time). Set this env to a registered origin: https://app.aipocketagency.com
 * in prod, http://localhost:3000 for local dev.
 */
export function gmailRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/gmail/callback`;
}

// 401, or an OAuth body carrying invalid_grant, means the refresh token is dead —
// the caller should flip the connection to status='error' rather than retry.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || body.includes("invalid_grant") || status === 403;
}

// ─── Token endpoints ──────────────────────────────────────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type GmailTokenResponse = z.infer<typeof TokenResponseSchema>;

function oauthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GmailResult<GmailTokenResponse>> {
  const creds = oauthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GmailResult<GmailTokenResponse>> {
  const creds = oauthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

async function parseTokenResponse(res: Response): Promise<GmailResult<GmailTokenResponse>> {
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

/** Revoke a refresh/access token at Google. Best-effort: a failure is non-fatal. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is wiped regardless.
  }
}

/**
 * Return a valid access token for a connection, refreshing + persisting it when
 * the cached one is missing or within 60s of expiry. Skews early so an in-flight
 * batch never trips on expiry mid-request.
 */
export async function ensureFreshAccessToken(
  conn: GmailConnectionFull,
): Promise<GmailResult<string>> {
  const now = Date.now();
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  if (!conn.refresh_token_encrypted) {
    return { ok: false, status: 401, error: "no_refresh_token", authError: true };
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(conn.refresh_token_encrypted);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "decrypt_failed",
      authError: false,
    };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.ok) return refreshed;

  const newExpiry = new Date(now + refreshed.data.expires_in * 1000).toISOString();
  await updateGmailAccessToken(conn.id, refreshed.data.access_token, newExpiry);
  return { ok: true, data: refreshed.data.access_token };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  emailAddress: z.string().optional(),
  historyId: z.string().optional(),
});
export type GmailProfile = z.infer<typeof ProfileSchema>;

export async function getProfile(accessToken: string): Promise<GmailResult<GmailProfile>> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  return parseJson(res, ProfileSchema);
}

// ─── messages.list (first-run window) ─────────────────────────────────────────

const MessageRefSchema = z.object({ id: z.string(), threadId: z.string() });
const MessagesListSchema = z.object({
  messages: z.array(MessageRefSchema).optional(),
  resultSizeEstimate: z.number().optional(),
});

/** Recent inbox messages, newest first, capped at `max`. Used on a connection's first sync. */
export async function listRecentInboxMessages(
  accessToken: string,
  max: number,
): Promise<GmailResult<{ id: string; threadId: string }[]>> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", "in:inbox newer_than:7d -category:promotions -category:social");
  url.searchParams.set("maxResults", String(max));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const parsed = await parseJson(res, MessagesListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.messages ?? [] };
}

// ─── history.list (incremental) ───────────────────────────────────────────────

const HistorySchema = z.object({
  history: z
    .array(
      z.object({
        messagesAdded: z
          .array(z.object({ message: MessageRefSchema.extend({ labelIds: z.array(z.string()).optional() }) }))
          .optional(),
      }),
    )
    .optional(),
  historyId: z.string().optional(),
});

/**
 * Messages added since `startHistoryId`. Returns the new message refs that landed
 * in the inbox plus the latest historyId to persist as the next cursor.
 */
export async function listHistoryAdded(
  accessToken: string,
  startHistoryId: string,
  max: number,
): Promise<GmailResult<{ messages: { id: string; threadId: string }[]; historyId: string | null }>> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("labelId", "INBOX");
  url.searchParams.set("maxResults", String(max));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const parsed = await parseJson(res, HistorySchema);
  if (!parsed.ok) return parsed;

  const seen = new Set<string>();
  const messages: { id: string; threadId: string }[] = [];
  for (const h of parsed.data.history ?? []) {
    for (const added of h.messagesAdded ?? []) {
      const m = added.message;
      // Only inbox arrivals; skip drafts/sent that history can surface.
      if (m.labelIds && !m.labelIds.includes("INBOX")) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      messages.push({ id: m.id, threadId: m.threadId });
      if (messages.length >= max) break;
    }
    if (messages.length >= max) break;
  }
  return { ok: true, data: { messages, historyId: parsed.data.historyId ?? null } };
}

// ─── messages.get (metadata) ──────────────────────────────────────────────────

const MessageMetaSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string().optional(),
  internalDate: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  payload: z
    .object({
      headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    })
    .optional(),
});

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: string | null;
  inInbox: boolean;
  // The RFC 2822 Message-ID header (e.g. "<CA+abc@mail.gmail.com>"). Threading a
  // reply requires it in the In-Reply-To + References headers — distinct from the
  // Gmail API message id. Empty when the header is absent.
  rfcMessageId: string;
};

export async function getMessageMeta(
  accessToken: string,
  messageId: string,
): Promise<GmailResult<GmailMessageMeta>> {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "From");
  url.searchParams.append("metadataHeaders", "Subject");
  url.searchParams.append("metadataHeaders", "Date");
  url.searchParams.append("metadataHeaders", "Message-ID");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const parsed = await parseJson(res, MessageMetaSchema);
  if (!parsed.ok) return parsed;

  const headers = parsed.data.payload?.headers ?? [];
  const header = (name: string): string =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  return {
    ok: true,
    data: {
      id: parsed.data.id,
      threadId: parsed.data.threadId,
      from: header("From"),
      subject: header("Subject"),
      snippet: parsed.data.snippet ?? "",
      internalDate: parsed.data.internalDate ?? null,
      inInbox: parsed.data.labelIds ? parsed.data.labelIds.includes("INBOX") : true,
      rfcMessageId: header("Message-ID"),
    },
  };
}

// ─── threads.modify (archive) ─────────────────────────────────────────────────

/** Archive a thread by removing the INBOX label. */
export async function archiveThread(
  accessToken: string,
  threadId: string,
): Promise<GmailResult<void>> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  return { ok: true, data: undefined };
}

// ─── messages.send (send AS the user) ─────────────────────────────────────────

const SendResponseSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
});
export type GmailSendResponse = z.infer<typeof SendResponseSchema>;

/**
 * Send a raw RFC 2822 message via users.messages.send. `raw` is the unencoded MIME
 * string — this function base64url-encodes it for the API. When `threadId` is set
 * (and the message carries In-Reply-To/References + a matching Subject), Gmail files
 * the reply inside that conversation; the sent copy lands in the user's Sent folder.
 */
export async function sendGmailMessage(
  accessToken: string,
  params: { raw: string; threadId?: string | null },
): Promise<GmailResult<GmailSendResponse>> {
  const encodedRaw = Buffer.from(params.raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const body: { raw: string; threadId?: string } = { raw: encodedRaw };
  if (params.threadId) body.threadId = params.threadId;

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  return parseJson(res, SendResponseSchema);
}

// ─── Shared JSON parse ────────────────────────────────────────────────────────

async function parseJson<T>(
  res: Response,
  schema: z.ZodType<T>,
): Promise<GmailResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "gmail returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "gmail response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}
