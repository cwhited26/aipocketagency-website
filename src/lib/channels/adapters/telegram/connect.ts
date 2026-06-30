// lib/channels/adapters/telegram/connect.ts — the Telegram pairing orchestration (Channels Gateway
// Phase 2, PA-CHAN-1). Telegram has no OAuth: the owner mints a bot in BotFather and pastes its token
// + a webhook secret. Connecting is three steps, all direct REST (api.ts):
//   1. getMe       — validate the token, read the bot's id + username (the externalId is tg:<botId>).
//   2. setWebhook  — point the bot at our per-bot webhook URL with the owner's secret token.
//   3. upsert      — store the bot token (encrypted) + the webhook secret (encrypted, in config).
// The bot token rides in auth_token_encrypted (so the adapter's outbound path reads it like Slack's
// bot token); the webhook secret rides encrypted in config so the inbound webhook can verify the
// per-delivery secret-token header (signing.ts) before trusting the body.

import { encrypt } from "@/lib/crypto/encrypt";
import { upsertChannelConnection } from "@/lib/channels/store";
import { telegramGetMe, telegramSetWebhook, telegramDeleteWebhook } from "./api";
import { isValidTelegramSecretToken } from "./signing";
import { telegramExternalId } from "./adapter";

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

// The config key the inbound webhook reads to verify the secret-token header (encrypted envelope).
export const TELEGRAM_WEBHOOK_SECRET_CONFIG_KEY = "webhookSecretEncrypted";

/** The per-bot inbound webhook URL. The botId is in the path so the webhook resolves the owner. */
export function telegramWebhookUrl(botId: string): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/api/channels/telegram/webhook/${botId}`;
}

export type TelegramConnectResult =
  | { ok: true; botId: string; botUsername: string | null }
  | { ok: false; status: number; error: string };

/**
 * Validate + register a Telegram bot for an owner. Pure-ish orchestration over the transport: a bad
 * token, an invalid secret, a setWebhook failure, or a store error all surface as a typed error the
 * route maps to copy. On success the connection is live and Telegram begins delivering to the webhook.
 */
export async function connectTelegramBot(args: {
  ownerId: string;
  botToken: string;
  webhookSecret: string;
}): Promise<TelegramConnectResult> {
  const botToken = args.botToken.trim();
  const webhookSecret = args.webhookSecret.trim();

  if (!botToken) return { ok: false, status: 400, error: "missing_token" };
  if (!isValidTelegramSecretToken(webhookSecret)) {
    return { ok: false, status: 400, error: "invalid_secret" };
  }

  // 1. Validate the token + read identity.
  const me = await telegramGetMe(botToken);
  if (!me.ok) {
    return { ok: false, status: me.authError ? 401 : 502, error: me.authError ? "invalid_token" : "telegram_error" };
  }
  const botId = String(me.data.id);
  const botUsername = me.data.username ?? null;

  // 2. Register the webhook with the secret token.
  const hook = await telegramSetWebhook(botToken, telegramWebhookUrl(botId), webhookSecret);
  if (!hook.ok) {
    return { ok: false, status: 502, error: "set_webhook_failed" };
  }

  // 3. Persist (bot token encrypted in auth_token; webhook secret encrypted in config).
  const result = await upsertChannelConnection({
    ownerId: args.ownerId,
    channelSlug: "telegram",
    externalId: telegramExternalId(botId),
    authToken: botToken,
    config: {
      botId,
      botUsername,
      [TELEGRAM_WEBHOOK_SECRET_CONFIG_KEY]: encrypt(webhookSecret),
    },
  });
  if (!result.ok) {
    // Roll the webhook back so we don't leave Telegram pointed at a connection we failed to store.
    await telegramDeleteWebhook(botToken);
    return { ok: false, status: result.status, error: "store_failed" };
  }

  return { ok: true, botId, botUsername };
}
