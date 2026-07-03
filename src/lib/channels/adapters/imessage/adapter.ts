// lib/channels/adapters/imessage/adapter.ts — the iMessage ChannelAdapter (Channels Gateway
// Phase 3, PA-CHAN-1/11). BlueBubbles bridge: the owner self-hosts a BlueBubbles server on their
// own Mac (bluebubbles.app), which relays iMessage in both directions over REST + a webhook.
// Direct fetch — no SDK.
//
// Inbound: BlueBubbles POSTs { type: 'new-message', data: {...} } to /api/channels/inbound/imessage.
// Signature verification (signing.ts, HMAC-SHA256 hex of the raw body) needs the connection's saved
// webhook secret, so the route drives verification and hands the gateway a finished ChannelMessage —
// the same route-driven pattern as Telegram and SMS. classifyBlueBubblesPayload here is the pure
// structural parse the route (and the tests) use.
//
// Outbound: POST ${serverUrl}/api/v1/message/text?password=… with { chatGuid, message }. iMessage
// renders no buttons — a staged reply gets the APPROVE / EDIT / REJECT text protocol footer, and
// URL buttons flatten to "label: url" lines.

import { z } from "zod";
import {
  ChannelSendError,
  type ChannelAdapter,
  type ChannelConnection,
  type ChannelMessage,
  type ChannelResponse,
  type ParseInboundContext,
} from "@/lib/channels/types";
import { channelLog } from "@/lib/channels/log";
import { STAGED_PROTOCOL_FOOTER } from "@/lib/channels/staged-actions";

// The iMessage externalId namespace: the OWNER's handle (phone in E.164 or an email — iMessage
// allows both). Normalized so "+1 (555) 111-2222" and "+15551112222" resolve the same pairing.
export function imessageExternalId(handle: string): string {
  return `imsg:${normalizeImessageHandle(handle)}`;
}

/** Lowercase emails; strip everything but digits and the leading + from phone handles. */
export function normalizeImessageHandle(handle: string): string {
  const trimmed = handle.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^\d]/g, "");
}

// ── Inbound (Zod at the webhook boundary) ───────────────────────────────────────────────────────

// The BlueBubbles webhook envelope. Everything except type/data.guid is optional-tolerant: server
// versions vary, and an unparseable delivery should classify as ignore, not crash the route.
export const BlueBubblesWebhookSchema = z
  .object({
    type: z.string(),
    data: z
      .object({
        guid: z.string(),
        text: z.string().nullable().optional(),
        isFromMe: z.boolean().optional(),
        chats: z.array(z.object({ guid: z.string() }).passthrough()).optional(),
        handle: z.object({ address: z.string() }).passthrough().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type BlueBubblesInboundClassified =
  | { kind: "ignore"; reason: string }
  | { kind: "message"; handle: string; chatGuid: string; guid: string; text: string };

/**
 * Structurally classify a raw BlueBubbles webhook body. Only an inbound 'new-message' with a
 * sender handle, a chat, and non-empty text routes; our own outgoing messages (isFromMe — which
 * include the replies we send through the relay) are ignored so the bridge can't loop on itself.
 */
export function classifyBlueBubblesPayload(rawBody: string): BlueBubblesInboundClassified {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { kind: "ignore", reason: "not_json" };
  }
  const parsed = BlueBubblesWebhookSchema.safeParse(json);
  if (!parsed.success) return { kind: "ignore", reason: "shape" };
  const { type, data } = parsed.data;
  if (type !== "new-message") return { kind: "ignore", reason: `type:${type}` };
  if (data.isFromMe === true) return { kind: "ignore", reason: "from_me" };
  const handle = data.handle?.address?.trim();
  if (!handle) return { kind: "ignore", reason: "no_handle" };
  const chatGuid = data.chats?.[0]?.guid;
  if (!chatGuid) return { kind: "ignore", reason: "no_chat" };
  const text = (data.text ?? "").trim();
  if (!text) return { kind: "ignore", reason: "empty_text" };
  return { kind: "message", handle, chatGuid, guid: data.guid, text };
}

/** Build the normalized ChannelMessage for a verified iMessage inbound. */
export function buildImessageMessage(args: {
  handle: string;
  chatGuid: string;
  guid: string;
  text: string;
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "imessage",
    externalId: imessageExternalId(args.handle),
    body: args.text,
    threadId: args.chatGuid,
    // PA-CHAN-5: every channel message is untrusted inbound content.
    untrustedOrigin: true,
    // The message guid is provider-stable — anchors cost idempotency across a webhook redelivery.
    providerMessageId: args.guid,
    channelMeta: { chatGuid: args.chatGuid, surface: "im" },
    rawPayload: args.rawPayload,
  };
}

// ── Server credentials (per-connection paste-in, env fallback for the self-host default) ────────

export type BlueBubblesServer = { serverUrl: string; password: string };

/** The BlueBubbles server this connection talks to: the pasted-in pair, else the env pair. */
export function blueBubblesServerForConnection(
  connection: ChannelConnection,
): BlueBubblesServer | null {
  const cfgUrl =
    typeof connection.config.serverUrl === "string" && connection.config.serverUrl
      ? connection.config.serverUrl
      : null;
  if (cfgUrl && connection.authToken) {
    return { serverUrl: cfgUrl.replace(/\/+$/, ""), password: connection.authToken };
  }
  const envUrl = process.env.PA_BLUEBUBBLES_URL;
  const envPassword = process.env.PA_BLUEBUBBLES_PASSWORD;
  if (!envUrl || !envPassword) return null;
  return { serverUrl: envUrl.replace(/\/+$/, ""), password: envPassword };
}

// ── Outbound ────────────────────────────────────────────────────────────────────────────────────

/** Flatten a ChannelResponse into plain iMessage text (same affordance rules as SMS). Exported for
 *  tests. */
export function renderImessageText(response: ChannelResponse): string {
  const parts = [response.text.trim()];
  if (response.staged) {
    parts.push(STAGED_PROTOCOL_FOOTER);
  } else if (response.buttons && response.buttons.length > 0) {
    parts.push(response.buttons.map((b) => `${b.label.replace(/\s*→\s*$/, "")}: ${b.url}`).join("\n"));
  }
  return parts.filter(Boolean).join("\n\n");
}

async function sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void> {
  const server = blueBubblesServerForConnection(connection);
  if (!server) throw new ChannelSendError("bluebubbles_not_configured", true);

  const chatGuid = typeof response.channelMeta.chatGuid === "string" ? response.channelMeta.chatGuid : null;
  if (!chatGuid) throw new ChannelSendError("no_chat_guid", false);

  let res: Response;
  try {
    res = await fetch(
      `${server.serverUrl}/api/v1/message/text?password=${encodeURIComponent(server.password)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatGuid, message: renderImessageText(response) }),
        cache: "no-store",
      },
    );
  } catch (err) {
    // The owner's Mac is offline / unreachable — transient, not an auth failure.
    throw new ChannelSendError(
      err instanceof Error ? `bluebubbles_unreachable: ${err.message}` : "bluebubbles_unreachable",
      false,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    channelLog.error("bluebubbles send failed", {
      connectionId: connection.id,
      status: res.status,
    });
    // 401/403 = wrong server password → flip the connection to reconnect.
    throw new ChannelSendError(
      `bluebubbles_send_${res.status}: ${body.slice(0, 200)}`,
      res.status === 401 || res.status === 403,
    );
  }
}

export const imessageAdapter: ChannelAdapter = {
  slug: "imessage",
  pairingFlow: "phone_link",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    // The route owns the real inbound path: signature verification needs the connection's saved
    // webhook secret, which the bare context doesn't carry — same pattern as Telegram and SMS.
    void ctx;
    return null;
  },
  sendOutbound,
};
