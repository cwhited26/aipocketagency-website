// lib/channels/staged-actions.ts — the APPROVE / EDIT / REJECT text protocol for button-less
// channels (Channels Gateway Phases 2–4, PA-CHAN-9).
//
// SMS and iMessage can't render buttons, so a staged action arrives as text: "…Reply APPROVE to
// send, EDIT to change, or REJECT to cancel." The NEXT inbound from the same paired sender is
// matched to the owner's latest pending Mission Control card (workspace + sender identity were
// already verified by the webhook's signature + connection resolve; latest-first is the tiebreak).
// WhatsApp reaches the same handler through its native reply buttons (button ids approve/edit/reject).
//
// Blast radius is deliberately bounded (PA-CHAN-6 stays intact for everything else):
//   • APPROVE executes ONLY an Email Drafter draft — the same Gmail send-as-you path the Inbox
//     approve route runs, sent as the owner, then resolved. Every other staged kind gets a
//     Mission Control deep link instead of a blind approval (capture filings, memory writes, and
//     blueprint advances have side effects the owner should see before confirming).
//   • REJECT resolves the card as rejected — no external effect, safe for every kind.
//   • EDIT never mutates from the channel — it deep-links into Mission Control where the card's
//     edit affordances live.
// The sender identity is the SAME owner the connection was paired to, verified per delivery by the
// channel's signature check — so a protocol approval is still an owner approval, just not via the
// web app.

import {
  fetchLatestPendingInboxItem,
  resolveInboxItem,
  type InboxItem,
} from "@/lib/pa-inbox-items";
import { ensureFreshAccessToken, hasGmailSendScope } from "@/lib/gmail";
import { fetchGmailConnectionFull, markGmailConnectionError } from "@/lib/pa-gmail-connections";
import { execute as gmailSend } from "@/lib/connectors/gmail/actions/send";
import { channelLog } from "./log";
import type { ChannelConnection } from "./types";

// The footer button-less adapters append to a staged reply (ChannelResponse.staged).
export const STAGED_PROTOCOL_FOOTER =
  "Reply APPROVE to send, EDIT to change, or REJECT to cancel.";

// The kinds the protocol will even look at. 'draft' covers Email Drafter (executable) and the
// other draft sources (deep-linked); 'decision' cards deep-link too.
const PROTOCOL_KINDS = ["draft", "decision"] as const;

export type ProtocolCommand = "approve" | "edit" | "reject";

/**
 * Match an inbound body against the text protocol. Exact single-word match (case-insensitive,
 * trailing punctuation tolerated) so a sentence that merely contains "approve" still reaches the
 * agent as a normal message.
 */
export function matchProtocolCommand(body: string): ProtocolCommand | null {
  const word = body.trim().toLowerCase().replace(/[.!]+$/, "");
  if (word === "approve" || word === "yes") return "approve";
  if (word === "edit" || word === "change") return "edit";
  if (word === "reject" || word === "cancel" || word === "no") return "reject";
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((r) => r.trim())
    .filter(Boolean);
}

function isEmailDraft(item: InboxItem): boolean {
  return item.kind === "draft" && item.source === "email-drafter";
}

// ── APPROVE: execute an Email Drafter draft (the same path the Inbox approve route runs) ────────

async function approveEmailDraft(ownerId: string, item: InboxItem): Promise<string> {
  const conn = await fetchGmailConnectionFull(ownerId);
  if (!conn.ok || !conn.data || conn.data.status === "revoked") {
    return "I can't send it — Gmail isn't connected. Connect Gmail in Settings, then approve it in Mission Control.";
  }
  if (!hasGmailSendScope(conn.data.scopes)) {
    return "I can't send it — your Gmail connection is missing send permission. Reconnect Gmail in Settings, then approve it in Mission Control.";
  }

  const token = await ensureFreshAccessToken(conn.data);
  if (!token.ok) {
    if (token.authError) await markGmailConnectionError(conn.data.id);
    return "I can't send it — your Gmail authorization expired. Reconnect Gmail in Settings, then approve it in Mission Control.";
  }

  const to = parseRecipients(str(item.payload.to));
  if (to.length === 0) {
    return "That draft is missing a recipient — open it in Mission Control to fix and send.";
  }

  const result = await gmailSend({
    accessToken: token.data,
    fromEmail: conn.data.email,
    input: {
      to,
      subject: str(item.payload.subject) || "(no subject)",
      body_text: str(item.payload.body) || item.body_md || "",
      in_reply_to: str(item.payload.inReplyTo) || undefined,
      thread_id: str(item.payload.threadId) || undefined,
      from: conn.data.email ?? undefined,
    },
  });
  if (!result.ok) {
    if (result.authError) await markGmailConnectionError(conn.data.id);
    // Leave the card pending so the owner can retry from Mission Control — nothing was sent.
    return "Gmail wouldn't take it just now — nothing was sent. Try again, or send it from Mission Control.";
  }

  const resolved = await resolveInboxItem(item.id, "approved", ownerId);
  if (!resolved.ok) {
    channelLog.error("staged approve sent but resolve failed", {
      itemId: item.id,
      status: resolved.status,
    });
  }
  return `Sent — "${item.title}" is on its way.`;
}

// ── The protocol handler ────────────────────────────────────────────────────────────────────────

/**
 * Resolve a protocol command against the owner's latest pending staged card and return the reply
 * text the adapter should send back. Never throws — every failure path is honest reply copy.
 */
export async function handleStagedActionReply(args: {
  connection: ChannelConnection;
  command: ProtocolCommand;
  missionControlUrl: string;
}): Promise<{ text: string }> {
  const ownerId = args.connection.ownerId;
  const latest = await fetchLatestPendingInboxItem(ownerId, PROTOCOL_KINDS);
  if (!latest.ok) {
    channelLog.error("staged protocol lookup failed", {
      channelSlug: args.connection.channelSlug,
      status: latest.status,
    });
    return { text: "I couldn't check what's pending just now. Try again in a moment." };
  }
  const item = latest.data;
  if (!item) {
    return {
      text: `Nothing is waiting on your approval right now. Mission Control: ${args.missionControlUrl}`,
    };
  }

  switch (args.command) {
    case "reject": {
      const resolved = await resolveInboxItem(item.id, "rejected", ownerId);
      if (!resolved.ok) {
        return { text: "I couldn't cancel it just now — try again, or reject it in Mission Control." };
      }
      return { text: `Rejected — "${item.title}" was canceled. Nothing was sent.` };
    }

    case "edit":
      return {
        text: `Open "${item.title}" to edit it before it goes out: ${args.missionControlUrl}`,
      };

    case "approve": {
      if (isEmailDraft(item)) {
        return { text: await approveEmailDraft(ownerId, item) };
      }
      // Anything that isn't a plain email draft has side effects the owner should see first.
      return {
        text: `"${item.title}" needs your eyes in Mission Control to approve: ${args.missionControlUrl}`,
      };
    }
  }
}

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The Mission Control deep link protocol replies point at (mirrors gateway.ts). */
export function stagedMissionControlUrl(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/app/mission-control`;
}
