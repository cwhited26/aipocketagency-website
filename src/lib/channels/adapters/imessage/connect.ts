// lib/channels/adapters/imessage/connect.ts — the iMessage pairing orchestration (Channels Gateway
// Phase 3, PA-CHAN-11). The owner self-hosts BlueBubbles on their own Mac and pastes the server
// URL + password + a webhook secret (they also point the BlueBubbles webhook at our inbound route
// and enable payload signing with the same secret). Connecting is two steps, direct REST:
//   1. GET ${url}/api/v1/ping?password=… — validate the URL + password pair against the server.
//   2. upsert — password encrypted in auth_token_encrypted; server URL + owner handle in config;
//      webhook secret encrypted in config (the inbound route decrypts it to verify X-BB-Signature).

import { encrypt } from "@/lib/crypto/encrypt";
import { upsertChannelConnection } from "@/lib/channels/store";
import { imessageExternalId, normalizeImessageHandle } from "./adapter";

// The config key the inbound webhook reads to verify the X-BB-Signature header (encrypted envelope).
export const IMESSAGE_WEBHOOK_SECRET_CONFIG_KEY = "webhookSecretEncrypted";

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The shared inbound webhook the owner registers in BlueBubbles (Settings → API & Webhooks). */
export function imessageChannelInboundUrl(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/api/channels/inbound/imessage`;
}

export type ImessageConnectResult =
  | { ok: true; ownerHandle: string }
  | { ok: false; status: number; error: string };

/**
 * Validate + store an owner's BlueBubbles pairing. A bad URL, a wrong password, or a store failure
 * all surface as a typed error the route maps to copy.
 */
export async function connectImessageChannel(args: {
  ownerId: string;
  serverUrl: string;
  password: string;
  webhookSecret: string;
  ownerHandle: string;
}): Promise<ImessageConnectResult> {
  const serverUrl = args.serverUrl.trim().replace(/\/+$/, "");
  const password = args.password.trim();
  const webhookSecret = args.webhookSecret.trim();
  const ownerHandle = normalizeImessageHandle(args.ownerHandle);

  if (!/^https?:\/\/.+/.test(serverUrl)) return { ok: false, status: 400, error: "invalid_url" };
  if (!password) return { ok: false, status: 400, error: "missing_password" };
  if (webhookSecret.length < 16) return { ok: false, status: 400, error: "weak_secret" };
  if (!ownerHandle || (!ownerHandle.includes("@") && !/^\+\d{8,15}$/.test(ownerHandle))) {
    return { ok: false, status: 400, error: "invalid_handle" };
  }

  // 1. Validate the URL + password pair against the owner's server (read-only ping).
  let ping: Response;
  try {
    ping = await fetch(`${serverUrl}/api/v1/ping?password=${encodeURIComponent(password)}`, {
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "server_unreachable" };
  }
  if (ping.status === 401 || ping.status === 403) {
    return { ok: false, status: 401, error: "invalid_password" };
  }
  if (!ping.ok) return { ok: false, status: 502, error: "server_error" };

  // 2. Persist (password encrypted by the store; webhook secret encrypted in config).
  const result = await upsertChannelConnection({
    ownerId: args.ownerId,
    channelSlug: "imessage",
    externalId: imessageExternalId(ownerHandle),
    authToken: password,
    config: {
      serverUrl,
      ownerHandle,
      [IMESSAGE_WEBHOOK_SECRET_CONFIG_KEY]: encrypt(webhookSecret),
    },
  });
  if (!result.ok) return { ok: false, status: result.status, error: "store_failed" };

  return { ok: true, ownerHandle };
}
