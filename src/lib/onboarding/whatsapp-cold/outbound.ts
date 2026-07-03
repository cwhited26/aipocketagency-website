// outbound.ts — sends from the PA public WhatsApp number (PA-POS-32). Direct REST against the
// Meta Cloud API, no SDK — the Channels Gateway Phase 4 posture. Cold sends don't ride the
// ChannelAdapter (there is no pa_channel_connections row for the public number by design), so
// this module owns the three payload shapes the funnel needs: text, native reply buttons
// (the use-case cards), and the §22.1 turn-2 save-contact card.

import { publicWhatsappNumber, type ColdWhatsappConfig } from "./config";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";
import type { ColdOutbound, ColdReplyButton } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";
const TEXT_LIMIT = 4_096;
const INTERACTIVE_BODY_LIMIT = 1_024;
const BUTTON_TITLE_LIMIT = 20;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** The Cloud API payload for one ColdOutbound. Pure — exported for tests. */
export function buildColdSendPayload(
  to: string,
  outbound: ColdOutbound,
): Record<string, unknown> | null {
  if (outbound.kind === "text") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: clip(outbound.text, TEXT_LIMIT) },
    };
  }

  if (outbound.kind === "buttons") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: clip(outbound.text, INTERACTIVE_BODY_LIMIT) },
        action: {
          buttons: outbound.buttons.slice(0, 3).map((b: ColdReplyButton) => ({
            type: "reply",
            reply: { id: b.id, title: clip(b.title, BUTTON_TITLE_LIMIT) },
          })),
        },
      },
    };
  }

  // §22.1 turn 2: the save-contact card. First-touch spelling is "Pocket" (§23.1).
  const displayNumber = publicWhatsappNumber();
  if (!displayNumber) return null;
  return {
    messaging_product: "whatsapp",
    to,
    type: "contacts",
    contacts: [
      {
        name: { formatted_name: "Pocket", first_name: "Pocket" },
        org: { company: "Pocket Agent" },
        phones: [{ phone: `+${displayNumber}`, type: "WORK", wa_id: displayNumber }],
      },
    ],
  };
}

/**
 * Sends a bundle in order. Best-effort per message — a Meta failure logs and continues so one
 * bad payload never eats the rest of the turn. Returns how many sends succeeded.
 */
export async function sendColdOutbound(
  config: ColdWhatsappConfig,
  to: string,
  bundle: readonly ColdOutbound[],
): Promise<number> {
  const sender = hashPhoneForLog(to);
  let sent = 0;
  for (const outbound of bundle) {
    const payload = buildColdSendPayload(to, outbound);
    if (!payload) {
      coldLog.warn("cold outbound skipped — payload unbuildable", { sender, kind: outbound.kind });
      continue;
    }
    let res: Response;
    try {
      res = await fetch(`${GRAPH_BASE}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch (err) {
      coldLog.error("cold outbound unreachable", {
        sender,
        kind: outbound.kind,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      coldLog.error("cold outbound send failed", {
        sender,
        kind: outbound.kind,
        status: res.status,
        error: body.slice(0, 200),
      });
      continue;
    }
    sent += 1;
  }
  return sent;
}
