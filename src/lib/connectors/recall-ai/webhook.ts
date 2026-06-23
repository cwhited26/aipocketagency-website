// connectors/recall-ai/webhook.ts — Recall.ai webhook signature verification + event parsing
// (Meeting Persona, MP-CORE-1).
//
// Recall.ai delivers webhooks via Svix (confirmed against docs.recall.ai/docs/webhooks, 2026-06-23).
// The Svix scheme signs the content `${svix-id}.${svix-timestamp}.${rawBody}` with HMAC-SHA256 using
// the endpoint secret, where the secret is `whsec_<base64>` and the signature header is a
// space-delimited list of `v<version>,<base64sig>` tokens (svix-signature header).
//
// verifyRecallSignature is the pure HMAC primitive: the route assembles the Svix signed content from
// the svix-id / svix-timestamp headers + the raw body and passes it here. The primitive also accepts
// a bare secret (utf8 key) and a bare/hex signature so it stays usable if Recall changes transport.
//
// TODO(2026-06-23 → verify before MP-CORE-7 public launch): reconcile the exact header names, secret
// decoding, and signed-content construction against a LIVE Recall webhook delivery. The Svix
// construction above is the documented scheme but has not yet been exercised against a real payload
// in this codebase. Until then the route still records every delivery (verified or not) to the audit
// table so a signature mismatch is visible rather than silent.

import crypto from "node:crypto";
import { z } from "zod";

// ── Event types (as named in the SPEC / MP-CORE-1 contract) ─────────────────────────────────────
export const RECALL_EVENT = {
  BOT_STATUS_CHANGE: "bot.status_change",
  RECORDING_DONE: "recording.done",
  TRANSCRIPT_DONE: "transcript.done",
} as const;
export type RecallEventType = (typeof RECALL_EVENT)[keyof typeof RECALL_EVENT];

/** Decode the Svix endpoint secret into raw key bytes. `whsec_<base64>` → base64 bytes; else utf8. */
function secretKeyBytes(secret: string): Buffer {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    return Buffer.from(trimmed.slice("whsec_".length), "base64");
  }
  return Buffer.from(trimmed, "utf8");
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Recall/Svix webhook signature.
 *
 * @param signedContent The exact bytes that were signed. For Svix this is
 *   `${svix-id}.${svix-timestamp}.${rawBody}` (the route assembles it). A simpler transport may pass
 *   the raw body alone.
 * @param signatureHeader The svix-signature header (space-delimited `v1,<b64>` tokens), or a bare
 *   signature.
 * @param secret The endpoint secret (`whsec_<base64>` or a raw key).
 * @returns true only when at least one provided signature matches.
 */
export function verifyRecallSignature(
  signedContent: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signatureHeader || !secret) return false;

  const key = secretKeyBytes(secret);
  if (key.length === 0) return false;

  const mac = crypto.createHmac("sha256", key).update(signedContent, "utf8").digest();
  const expectedB64 = mac.toString("base64");
  const expectedHex = mac.toString("hex");

  const candidates = signatureHeader
    .split(" ")
    .map((token) => {
      const comma = token.indexOf(",");
      return comma >= 0 ? token.slice(comma + 1) : token;
    })
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const candidate of candidates) {
    if (constantTimeEquals(candidate, expectedB64) || constantTimeEquals(candidate, expectedHex)) {
      return true;
    }
  }
  return false;
}

// ── Event payload parsing ────────────────────────────────────────────────────────────────────────
// Recall payloads carry the event type at `event` and the bot id at one of a few nested locations
// across API versions. We parse tolerantly and surface a normalized shape.

const RecallWebhookPayloadSchema = z
  .object({
    event: z.string(),
    data: z
      .object({
        bot: z.object({ id: z.string().optional() }).passthrough().optional(),
        bot_id: z.string().optional(),
        data: z
          .object({
            bot: z.object({ id: z.string().optional() }).passthrough().optional(),
            code: z.string().optional(),
          })
          .passthrough()
          .optional(),
        status: z.object({ code: z.string().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ParsedRecallEvent = {
  eventType: string;
  botId: string | null;
  statusCode: string | null;
};

/** Normalize a Recall webhook body into { eventType, botId, statusCode }. Returns null if unparseable. */
export function parseRecallEvent(payload: unknown): ParsedRecallEvent | null {
  const parsed = RecallWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const d = parsed.data.data;
  const botId =
    d?.bot?.id ?? d?.bot_id ?? d?.data?.bot?.id ?? null;
  const statusCode = d?.status?.code ?? d?.data?.code ?? null;
  return { eventType: parsed.data.event, botId: botId ?? null, statusCode: statusCode ?? null };
}

// ── Recording URL extraction (recording.done payload) ────────────────────────────────────────────
// The recording.done payload carries the playable URL; the exact path varies across Recall API
// versions, so we probe the documented locations tolerantly. Returns null when none is present (the
// route logs a warning rather than failing — the precise path is confirmed in MP-CORE-3).
const RecordingPayloadSchema = z
  .object({
    data: z
      .object({
        recording: z.object({ url: z.string().optional() }).passthrough().optional(),
        video_url: z.string().optional(),
        url: z.string().optional(),
        data: z
          .object({
            recording: z.object({ url: z.string().optional() }).passthrough().optional(),
            video_url: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export function extractRecordingUrl(payload: unknown): string | null {
  const parsed = RecordingPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const d = parsed.data.data;
  return (
    d?.recording?.url ??
    d?.video_url ??
    d?.url ??
    d?.data?.recording?.url ??
    d?.data?.video_url ??
    null
  );
}

// ── Recall status code → session status mapping ──────────────────────────────────────────────────
// Maps a bot.status_change code to our pa_meeting_persona_sessions.status enum. Unknown codes return
// null (leave the session status unchanged).
export function mapRecallStatusToSessionStatus(
  code: string | null,
):
  | "joining"
  | "in_meeting"
  | "recording"
  | "left"
  | "failed"
  | null {
  switch (code) {
    case "joining_call":
    case "in_waiting_room":
      return "joining";
    case "in_call_not_recording":
      return "in_meeting";
    case "in_call_recording":
    case "recording_permission_allowed":
      return "recording";
    case "call_ended":
    case "done":
      return "left";
    case "fatal":
    case "recording_permission_denied":
      return "failed";
    default:
      return null;
  }
}
