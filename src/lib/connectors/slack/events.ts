// lib/connectors/slack/events.ts — the inbound Slack Events API surface (PA-SLACK-DM-1).
//
// Two pure concerns live here so the webhook route stays a thin orchestrator and both are
// unit-tested without the network:
//   • verifySlackSignature — the v0 HMAC-SHA256 request-signature check (Slack's spec), with a
//     5-minute replay window and a constant-time compare. Fail closed on anything malformed.
//   • parseSlackEvent — validate the JSON envelope with Zod and reduce it to one of a small set
//     of outcomes the route acts on: a URL-verification challenge, an owner DM, an @mention, or
//     "ignore" (bot echoes, message edits, anything we don't route).
//
// Loop safety: PA's own replies arrive back as `message.im` events carrying a `bot_id`. Any
// event with a `bot_id`, a `subtype` (bot_message / message_changed / message_deleted / …), or
// no human `user` is classified `ignore` so the agent never answers itself.

import crypto from "node:crypto";
import { z } from "zod";

// ─── Signature verification ─────────────────────────────────────────────────────

// Slack rejects (and we reject) requests whose timestamp is more than 5 minutes from now — the
// replay-attack window from Slack's verification guide.
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

/**
 * Verify an inbound Events API request signature. `rawBody` MUST be the exact bytes Slack sent
 * (read before JSON parsing) — re-serializing changes whitespace and breaks the HMAC.
 *
 * basestring = `v0:${timestamp}:${rawBody}` ; expected = `v0=` + HMAC_SHA256(signingSecret, basestring).
 */
export function verifySlackSignature(args: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds: number;
}): SignatureCheck {
  const { signingSecret, timestamp, signature, rawBody, nowSeconds } = args;
  if (!timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");

  // Constant-time compare. timingSafeEqual throws on length mismatch, so guard length first —
  // a wrong-length signature is simply a bad signature.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

// ─── Event envelope schemas ─────────────────────────────────────────────────────

// URL verification handshake (sent once when you set the Request URL on the Slack app).
const UrlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string().min(1),
});

// The inner event. `subtype` and `bot_id` mark non-human / echo events we ignore. `user` is the
// human author; `channel_type` is "im" for a DM. `thread_ts` is set when the message is already
// inside a thread.
const InnerEventSchema = z.object({
  type: z.string(),
  user: z.string().optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  text: z.string().optional(),
  channel: z.string().optional(),
  channel_type: z.string().optional(),
  ts: z.string().optional(),
  thread_ts: z.string().optional(),
});

const EventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string().optional(),
  event: InnerEventSchema,
});

// ─── Parsed outcome ─────────────────────────────────────────────────────────────

export type ParsedSlackEvent =
  | { kind: "challenge"; challenge: string }
  // A DM to the bot (`message` + channel_type "im") or an @mention in a channel (`app_mention`).
  // `surface` distinguishes the two for the origin chip + reply threading.
  | {
      kind: "message";
      surface: "im" | "channel";
      slackUserId: string;
      teamId: string | null;
      channel: string;
      text: string;
      // The ts to thread a channel reply under (the mention's own ts). Null for DMs (reply flat).
      threadTs: string | null;
    }
  // Everything we deliberately don't act on — with a reason for observability at the call site.
  | { kind: "ignore"; reason: string };

/** Strip a leading bot mention token (`<@U123>`) from app_mention text so the agent reads the ask. */
export function stripLeadingMention(text: string): string {
  return text.replace(/^\s*<@[A-Z0-9]+>\s*/i, "").trim();
}

/**
 * Reduce a parsed JSON envelope to a routing outcome. Returns `ignore` (never throws) for any
 * shape we don't handle so the webhook can ack 200 and move on.
 */
export function parseSlackEvent(body: unknown): ParsedSlackEvent {
  const challenge = UrlVerificationSchema.safeParse(body);
  if (challenge.success) return { kind: "challenge", challenge: challenge.data.challenge };

  const callback = EventCallbackSchema.safeParse(body);
  if (!callback.success) return { kind: "ignore", reason: "unsupported_envelope" };

  const { event, team_id } = callback.data;

  // Loop / noise guards: our own bot echo, any message subtype (edits, deletes, joins, bot posts),
  // or a missing author.
  if (event.bot_id) return { kind: "ignore", reason: "bot_message" };
  if (event.subtype) return { kind: "ignore", reason: `subtype:${event.subtype}` };
  if (!event.user) return { kind: "ignore", reason: "no_user" };
  if (!event.channel) return { kind: "ignore", reason: "no_channel" };

  const teamId = team_id ?? null;

  if (event.type === "app_mention") {
    const text = stripLeadingMention(event.text ?? "");
    if (!text) return { kind: "ignore", reason: "empty_mention" };
    return {
      kind: "message",
      surface: "channel",
      slackUserId: event.user,
      teamId,
      channel: event.channel,
      text,
      // Thread under the existing thread if there is one, else under the mention message itself.
      threadTs: event.thread_ts ?? event.ts ?? null,
    };
  }

  if (event.type === "message") {
    // Only DMs to the bot (im). Channel messages without an @mention are not ours to answer.
    if (event.channel_type !== "im") return { kind: "ignore", reason: "non_im_message" };
    const text = (event.text ?? "").trim();
    if (!text) return { kind: "ignore", reason: "empty_message" };
    return {
      kind: "message",
      surface: "im",
      slackUserId: event.user,
      teamId,
      channel: event.channel,
      text,
      threadTs: null,
    };
  }

  return { kind: "ignore", reason: `event_type:${event.type}` };
}
