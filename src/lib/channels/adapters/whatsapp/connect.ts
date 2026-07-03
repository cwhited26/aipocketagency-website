// lib/channels/adapters/whatsapp/connect.ts — the WhatsApp pairing orchestration (Channels Gateway
// Phase 4, PA-CHAN-12). No OAuth dance in-product: the owner creates a Meta app with the WhatsApp
// product (developers.facebook.com), then pastes their Phone Number ID + a System User access token
// + the app secret, plus their own WhatsApp number (the only routed sender). Connecting is two
// steps, direct REST:
//   1. GET /v20.0/{phoneNumberId} with Bearer auth — validate the id + token pair against Graph.
//   2. upsert — access token encrypted in auth_token_encrypted; app secret encrypted in config
//      (the inbound route decrypts it to verify X-Hub-Signature-256); numbers in config.

import { encrypt } from "@/lib/crypto/encrypt";
import { upsertChannelConnection } from "@/lib/channels/store";
import { whatsappExternalId, normalizeWhatsappNumber } from "./adapter";

// The config key the inbound webhook reads to verify X-Hub-Signature-256 (encrypted envelope).
export const WHATSAPP_APP_SECRET_CONFIG_KEY = "appSecretEncrypted";

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The shared inbound webhook the owner registers on their Meta app (WhatsApp → Configuration). */
export function whatsappChannelInboundUrl(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/api/channels/inbound/whatsapp`;
}

export type WhatsappConnectResult =
  | { ok: true; displayNumber: string | null }
  | { ok: false; status: number; error: string };

/**
 * Validate + store an owner's WhatsApp Cloud API pairing. A bad Phone Number ID, a dead token, or
 * a store failure all surface as a typed error the route maps to copy.
 */
export async function connectWhatsappChannel(args: {
  ownerId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  ownerNumber: string;
}): Promise<WhatsappConnectResult> {
  const phoneNumberId = args.phoneNumberId.trim();
  const accessToken = args.accessToken.trim();
  const appSecret = args.appSecret.trim();
  const ownerNumber = normalizeWhatsappNumber(args.ownerNumber);

  if (!/^\d{5,32}$/.test(phoneNumberId)) return { ok: false, status: 400, error: "invalid_phone_number_id" };
  if (!accessToken) return { ok: false, status: 400, error: "missing_token" };
  if (appSecret.length < 16) return { ok: false, status: 400, error: "weak_app_secret" };
  if (!/^\d{8,15}$/.test(ownerNumber)) return { ok: false, status: 400, error: "invalid_owner_number" };

  // 1. Validate the Phone Number ID + token pair against Graph (read-only; returns the display
  //    number so the settings card can show what's connected).
  let graphRes: Response;
  try {
    graphRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "meta_unreachable" };
  }
  if (graphRes.status === 401 || graphRes.status === 403) {
    return { ok: false, status: 401, error: "invalid_credentials" };
  }
  if (!graphRes.ok) return { ok: false, status: 502, error: "meta_error" };
  const graphBody = (await graphRes.json().catch(() => ({}))) as {
    display_phone_number?: string;
  };
  const displayNumber =
    typeof graphBody.display_phone_number === "string" ? graphBody.display_phone_number : null;

  // 2. Persist (access token encrypted by the store; app secret encrypted in config).
  const result = await upsertChannelConnection({
    ownerId: args.ownerId,
    channelSlug: "whatsapp",
    externalId: whatsappExternalId(phoneNumberId),
    authToken: accessToken,
    config: {
      phoneNumberId,
      ownerNumber,
      ...(displayNumber ? { displayNumber } : {}),
      [WHATSAPP_APP_SECRET_CONFIG_KEY]: encrypt(appSecret),
    },
  });
  if (!result.ok) return { ok: false, status: result.status, error: "store_failed" };

  return { ok: true, displayNumber };
}
