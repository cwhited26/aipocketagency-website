// lib/channels/adapters/telegram/api.ts — the Telegram Bot API transport for the Channels Gateway
// Telegram adapter (Channels Gateway Phase 2, PA-CHAN-1).
//
// Direct REST against https://api.telegram.org/bot<token>/<method> — no SDK (no grammy/telegraf),
// matching the Slack adapter's posture (lib/slack.ts: direct fetch, Zod at the boundary, a typed
// discriminated result instead of throwing). The serverless webhook + the pure-function adapter
// pattern want a thin transport, not a stateful bot framework.
//
// Telegram quirk: the API answers HTTP 200 with `{ ok: false, error_code, description }` on logical
// failures (bad token, chat not found, bot blocked by the user). parseTelegramBody treats ok:false
// as an error so a caller never silently acts on a non-success body — the same shape as Slack's
// ok:false handling. A 401/blocked/deactivated token is surfaced as `authError` so the gateway flips
// the connection to a reconnect state.

import { z, type ZodType } from "zod";
import { channelLog } from "@/lib/channels/log";

const TELEGRAM_API_BASE = "https://api.telegram.org";

// Telegram's hard-fail conditions for the bot token itself: 401 Unauthorized (revoked / wrong token)
// and the 403 family where the user blocked or deleted the chat. Only a dead TOKEN warrants a
// reconnect; a per-chat 403 (user blocked the bot) is reported but not a token-level auth error.
const HARD_AUTH_DESCRIPTIONS = new Set(["unauthorized", "not found"]);

export type TelegramResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

const TelegramEnvelopeSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error_code: z.number().optional(),
  description: z.string().optional(),
});

function isTokenAuthFailure(httpStatus: number, errorCode: number | undefined, description: string): boolean {
  if (httpStatus === 401 || errorCode === 401) return true;
  return HARD_AUTH_DESCRIPTIONS.has(description.toLowerCase());
}

/**
 * Call a Telegram Bot API method and validate `result` against `schema`. Never throws — a transport
 * failure, a non-2xx, an `ok:false` body, or a shape mismatch all return a typed error result.
 */
export async function telegramApiCall<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
  schema: ZodType<T>,
): Promise<TelegramResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? `telegram unreachable: ${err.message}` : "telegram unreachable",
      authError: false,
    };
  }

  let parsed: z.infer<typeof TelegramEnvelopeSchema>;
  try {
    parsed = TelegramEnvelopeSchema.parse(await res.json());
  } catch {
    return { ok: false, status: 502, error: `telegram ${method} returned non-envelope JSON`, authError: false };
  }

  if (!parsed.ok) {
    const description = parsed.description ?? `telegram ${method} failed`;
    return {
      ok: false,
      status: res.status,
      error: description,
      authError: isTokenAuthFailure(res.status, parsed.error_code, description),
    };
  }

  const shaped = schema.safeParse(parsed.result);
  if (!shaped.success) {
    channelLog.error("telegram result shape invalid", { method });
    return { ok: false, status: 502, error: `telegram ${method} result shape invalid`, authError: false };
  }
  return { ok: true, data: shaped.data };
}

// ── Typed method wrappers ─────────────────────────────────────────────────────────────────────

const GetMeSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  username: z.string().optional(),
  first_name: z.string().optional(),
});
export type TelegramBotIdentity = z.infer<typeof GetMeSchema>;

/** Validate a bot token and read the bot's identity (id + username). The connect flow's first call. */
export function telegramGetMe(botToken: string): Promise<TelegramResult<TelegramBotIdentity>> {
  return telegramApiCall(botToken, "getMe", {}, GetMeSchema);
}

/**
 * Register the inbound webhook for this bot. `secretToken` is echoed back by Telegram in the
 * X-Telegram-Bot-Api-Secret-Token header on every delivery — the adapter verifies it (signing.ts).
 * We subscribe to `message` updates only (the gateway answers DMs; no callback_query this phase).
 */
export function telegramSetWebhook(
  botToken: string,
  url: string,
  secretToken: string,
): Promise<TelegramResult<boolean>> {
  return telegramApiCall(
    botToken,
    "setWebhook",
    {
      url,
      secret_token: secretToken,
      allowed_updates: ["message"],
      // A re-connect should not replay the backlog of messages sent while disconnected.
      drop_pending_updates: true,
    },
    z.boolean(),
  );
}

/** Remove the webhook on disconnect so Telegram stops delivering to a torn-down connection. */
export function telegramDeleteWebhook(botToken: string): Promise<TelegramResult<boolean>> {
  return telegramApiCall(botToken, "deleteWebhook", { drop_pending_updates: true }, z.boolean());
}

const GetFileSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_size: z.number().optional(),
  file_path: z.string().optional(),
});
export type TelegramFile = z.infer<typeof GetFileSchema>;

/** Resolve a file_id to a downloadable file_path (step 1 of the two-step Telegram file download). */
export function telegramGetFile(botToken: string, fileId: string): Promise<TelegramResult<TelegramFile>> {
  return telegramApiCall(botToken, "getFile", { file_id: fileId }, GetFileSchema);
}

/**
 * Download a resolved file's bytes (step 2). Files live at /file/bot<token>/<file_path>, a different
 * path from the API methods. Returns the raw buffer or a typed error. Bounded by `maxBytes` — a file
 * whose declared size exceeds the cap is refused before the fetch.
 */
export async function telegramDownloadFile(
  botToken: string,
  filePath: string,
): Promise<TelegramResult<Buffer>> {
  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API_BASE}/file/bot${botToken}/${filePath}`, { cache: "no-store" });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? `telegram file unreachable: ${err.message}` : "telegram file unreachable",
      authError: false,
    };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `telegram file download ${res.status}`, authError: res.status === 401 };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { ok: true, data: buf };
}

const SendMessageResultSchema = z.object({
  message_id: z.number(),
  chat: z.object({ id: z.number() }),
});

/** Post a reply to a chat. `replyMarkup` carries the inline URL keyboard (Mission Control links). */
export function telegramSendMessage(
  botToken: string,
  body: {
    chat_id: number | string;
    text: string;
    reply_to_message_id?: number;
    reply_markup?: Record<string, unknown>;
  },
): Promise<TelegramResult<z.infer<typeof SendMessageResultSchema>>> {
  return telegramApiCall(botToken, "sendMessage", { ...body }, SendMessageResultSchema);
}
