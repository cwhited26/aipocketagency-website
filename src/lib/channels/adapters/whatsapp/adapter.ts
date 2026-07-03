// lib/channels/adapters/whatsapp/adapter.ts — the WhatsApp ChannelAdapter (Channels Gateway
// Phase 4, PA-CHAN-1/12). Meta WhatsApp Business Cloud API, direct REST against graph.facebook.com
// — no SDK.
//
// Inbound: Meta POSTs the entry/changes/value envelope to /api/channels/inbound/whatsapp. Signature
// verification (signing.ts, X-Hub-Signature-256 over the raw body) needs the connection's saved app
// secret, so the route drives verification and hands the gateway a finished ChannelMessage — the
// same route-driven pattern as Telegram / SMS / iMessage. classifyWhatsappPayload here is the pure
// structural parse the route (and the tests) use; it also classifies native APPROVE / EDIT / REJECT
// button taps (interactive.button_reply) so a staged action can be resolved with one tap.
//
// Outbound: POST /v20.0/{phoneNumberId}/messages with Bearer auth. A staged reply renders native
// reply buttons (Approve & send / Edit / Reject); WhatsApp caps an interactive body at 1024 chars,
// so an over-long staged reply falls back to the SMS-style text protocol. URL buttons flatten to
// "label: url" lines (Cloud API reply buttons carry no URLs).

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
import { STAGED_PROTOCOL_FOOTER, type ProtocolCommand } from "@/lib/channels/staged-actions";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

// WhatsApp caps: 4096 chars for a text body, 1024 for an interactive body.
export const WHATSAPP_TEXT_LIMIT = 4096;
const INTERACTIVE_BODY_LIMIT = 1024;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// The WhatsApp externalId namespace: the owner's Business PHONE NUMBER ID (the webhook's
// value.metadata.phone_number_id) — one Cloud API number per pairing. The owner's own WhatsApp
// number (the only routed sender, PA-CHAN-12) rides in config.ownerNumber.
export function whatsappExternalId(phoneNumberId: string): string {
  return `wa:${phoneNumberId.trim()}`;
}

/** WhatsApp wa_id / from values are bare digit strings; normalize a pasted number to match. */
export function normalizeWhatsappNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

// ── Inbound (Zod at the webhook boundary) ───────────────────────────────────────────────────────

const WhatsappMessageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    type: z.string().optional(),
    text: z.object({ body: z.string() }).optional(),
    interactive: z
      .object({
        type: z.string().optional(),
        button_reply: z.object({ id: z.string(), title: z.string().optional() }).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const WhatsappWebhookSchema = z
  .object({
    entry: z.array(
      z
        .object({
          changes: z.array(
            z
              .object({
                value: z
                  .object({
                    metadata: z
                      .object({ phone_number_id: z.string() })
                      .passthrough()
                      .optional(),
                    messages: z.array(WhatsappMessageSchema).optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type WhatsappInboundClassified =
  | { kind: "ignore"; reason: string }
  | {
      kind: "message";
      phoneNumberId: string;
      from: string;
      messageId: string;
      text: string;
      // Set when the inbound is a native staged-action button tap rather than typed text.
      buttonCommand: ProtocolCommand | null;
    };

function asProtocolCommand(id: string): ProtocolCommand | null {
  return id === "approve" || id === "edit" || id === "reject" ? id : null;
}

/**
 * Structurally classify a raw Meta webhook body. Only the first message of the first change
 * routes (Meta batches; each delivery to a single-number pairing carries one user message —
 * status-only deliveries have no messages array and classify as ignore).
 */
export function classifyWhatsappPayload(rawBody: string): WhatsappInboundClassified {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { kind: "ignore", reason: "not_json" };
  }
  const parsed = WhatsappWebhookSchema.safeParse(json);
  if (!parsed.success) return { kind: "ignore", reason: "shape" };

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const message = value.messages?.[0];
      if (!phoneNumberId || !message) continue;

      const buttonId = message.interactive?.button_reply?.id;
      const buttonCommand = buttonId ? asProtocolCommand(buttonId) : null;
      const text = buttonCommand
        ? (message.interactive?.button_reply?.title ?? buttonCommand)
        : (message.text?.body ?? "").trim();
      if (!text) return { kind: "ignore", reason: "no_text" };

      return {
        kind: "message",
        phoneNumberId,
        from: message.from,
        messageId: message.id,
        text,
        buttonCommand,
      };
    }
  }
  return { kind: "ignore", reason: "no_message" };
}

/** Build the normalized ChannelMessage for a verified WhatsApp inbound. */
export function buildWhatsappMessage(args: {
  phoneNumberId: string;
  from: string;
  messageId: string;
  text: string;
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "whatsapp",
    externalId: whatsappExternalId(args.phoneNumberId),
    body: args.text,
    // WhatsApp has no threads; the conversation is the number pair.
    threadId: null,
    // PA-CHAN-5: every channel message is untrusted inbound content.
    untrustedOrigin: true,
    // Meta's message id (wamid.…) is provider-stable — anchors cost idempotency across redelivery.
    providerMessageId: args.messageId,
    channelMeta: { from: args.from, phoneNumberId: args.phoneNumberId, surface: "im" },
    rawPayload: args.rawPayload,
  };
}

// ── Credentials (per-connection paste-in, env fallback) ─────────────────────────────────────────

export type WhatsappSendCreds = { phoneNumberId: string; accessToken: string };

/** The Cloud API credentials this connection sends with: the pasted-in pair, else the env pair. */
export function whatsappCredsForConnection(connection: ChannelConnection): WhatsappSendCreds | null {
  const phoneNumberId = connection.externalId.replace(/^wa:/, "");
  if (connection.authToken) return { phoneNumberId, accessToken: connection.authToken };
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!envToken) return null;
  return { phoneNumberId: envPhoneNumberId ?? phoneNumberId, accessToken: envToken };
}

// ── Outbound ────────────────────────────────────────────────────────────────────────────────────

/** Flatten a text-mode reply (buttons become "label: url" lines; a staged reply that couldn't
 *  render native buttons gets the text protocol footer). Exported for tests. */
export function renderWhatsappText(response: ChannelResponse): string {
  const parts = [response.text.trim()];
  if (response.staged) {
    parts.push(STAGED_PROTOCOL_FOOTER);
  } else if (response.buttons && response.buttons.length > 0) {
    parts.push(response.buttons.map((b) => `${b.label.replace(/\s*→\s*$/, "")}: ${b.url}`).join("\n"));
  }
  return clip(parts.filter(Boolean).join("\n\n"), WHATSAPP_TEXT_LIMIT);
}

/** The Cloud API message payload for a reply — native Approve / Edit / Reject buttons when the
 *  staged body fits WhatsApp's interactive limit, else plain text. Exported for tests. */
export function buildWhatsappSendPayload(
  to: string,
  response: ChannelResponse,
): Record<string, unknown> {
  if (response.staged && response.text.trim().length <= INTERACTIVE_BODY_LIMIT) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: clip(response.text.trim(), INTERACTIVE_BODY_LIMIT) },
        action: {
          buttons: [
            { type: "reply", reply: { id: "approve", title: "Approve & send" } },
            { type: "reply", reply: { id: "edit", title: "Edit" } },
            { type: "reply", reply: { id: "reject", title: "Reject" } },
          ],
        },
      },
    };
  }
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: renderWhatsappText(response) },
  };
}

async function sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void> {
  const creds = whatsappCredsForConnection(connection);
  if (!creds) throw new ChannelSendError("whatsapp_not_configured", true);

  const metaFrom = response.channelMeta.from ?? connection.config.ownerNumber;
  const to = typeof metaFrom === "string" && metaFrom ? normalizeWhatsappNumber(metaFrom) : "";
  if (!to) throw new ChannelSendError("no_recipient", false);

  let res: Response;
  try {
    res = await fetch(`${GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildWhatsappSendPayload(to, response)),
      cache: "no-store",
    });
  } catch (err) {
    throw new ChannelSendError(
      err instanceof Error ? `whatsapp_unreachable: ${err.message}` : "whatsapp_unreachable",
      false,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    channelLog.error("whatsapp send failed", {
      connectionId: connection.id,
      status: res.status,
    });
    // 401 = dead/expired access token → flip the connection to reconnect.
    throw new ChannelSendError(
      `whatsapp_send_${res.status}: ${body.slice(0, 200)}`,
      res.status === 401,
    );
  }
}

export const whatsappAdapter: ChannelAdapter = {
  slug: "whatsapp",
  pairingFlow: "phone_link",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    // The route owns the real inbound path: signature verification needs the connection's saved
    // app secret, which the bare context doesn't carry — same pattern as the other Phase 2–4 routes.
    void ctx;
    return null;
  },
  sendOutbound,
};
