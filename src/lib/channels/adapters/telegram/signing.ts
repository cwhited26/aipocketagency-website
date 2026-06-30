// lib/channels/adapters/telegram/signing.ts — the Telegram adapter's inbound request verification.
//
// PA-CHAN-4: every inbound webhook is verified before its body is trusted; the gateway never accepts
// unsigned traffic. Telegram's mechanism differs from Slack's HMAC-of-the-body: when you register a
// webhook you pass a `secret_token`, and Telegram echoes it verbatim in the
// `X-Telegram-Bot-Api-Secret-Token` header on every delivery (Bot API §setWebhook). Verification is a
// constant-time comparison of that header against the per-connection secret the owner saved at
// connect time. A forged request to the public webhook URL can't reproduce the secret, so it fails
// here before the update is parsed into a routable message.
//
// This is a SHARED-SECRET header check, not an HMAC over the payload — that is Telegram's design, not
// a shortcut. The secret is stored encrypted (lib/crypto/encrypt) and decrypted only at verify time.

import crypto from "node:crypto";

export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

// Telegram constrains the secret_token to 1–256 chars of A–Z a–z 0–9 _ and - (Bot API §setWebhook).
// The connect flow rejects anything else so the value we register always round-trips intact.
const SECRET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function isValidTelegramSecretToken(secret: string): boolean {
  return SECRET_TOKEN_PATTERN.test(secret);
}

export type TelegramSecretCheck =
  | { ok: true }
  | { ok: false; reason: "missing_header" | "bad_secret" };

/**
 * Verify the inbound delivery's secret-token header against the connection's saved secret. Constant
 * time: timingSafeEqual throws on a length mismatch, so guard length first — a wrong-length header is
 * simply a bad secret. An absent header is `missing_header` (the route answers 401).
 */
export function verifyTelegramSecret(args: {
  expectedSecret: string;
  headerSecret: string | null;
}): TelegramSecretCheck {
  const { expectedSecret, headerSecret } = args;
  if (!headerSecret) return { ok: false, reason: "missing_header" };

  const a = Buffer.from(expectedSecret, "utf8");
  const b = Buffer.from(headerSecret, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_secret" };
  }
  return { ok: true };
}
