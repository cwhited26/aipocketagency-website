// lib/channels/voice/realtime/stage.ts — the staging half of the voice approval gate (PA-CHAN-16).
//
// A realtime function call becomes an awaiting-approval Mission Control card here — the ONLY
// side-effect path a live call has. Mapping:
//   • send_email       → kind 'draft', source 'email-drafter' — the one-tap-approvable draft shape
//     (the Inbox approve route + the channels APPROVE protocol both know how to send it, as the
//     owner, AFTER the owner says yes).
//   • schedule_meeting → kind 'decision', source 'voice-call' — deep-link only; booking has side
//     effects the owner should see before confirming.
//   • create_follow_up → kind 'decision', source 'voice-call' — same posture.
// Nothing here executes. Approve/reject resolves through the existing Inbox surfaces.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { voiceLog } from "../log";
import type { StagedFunctionName } from "./messages";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Stage one voice function call as an inbox card. Returns the card id, or null when the write
 * failed (the caller tells the model the truth either way). Never throws — a staging hiccup
 * mid-call degrades to "couldn't stage it", not a dropped call.
 */
export async function stageVoiceFunctionCall(args: {
  ownerId: string;
  callId: string;
  fromNumber: string;
  direction: "inbound" | "outbound";
  name: StagedFunctionName;
  fnArgs: Record<string, unknown>;
}): Promise<string | null> {
  const onCallLine =
    args.direction === "inbound"
      ? `Staged by Poc on a call from ${args.fromNumber}.`
      : `Staged by Poc on an outbound call.`;

  const created =
    args.name === "send_email"
      ? await createInboxItem({
          userId: args.ownerId,
          kind: "draft",
          title: `Email: ${str(args.fnArgs.subject) || "(no subject)"}`,
          bodyMd: `${str(args.fnArgs.body)}\n\n---\n${onCallLine}`,
          source: "email-drafter",
          payload: {
            to: str(args.fnArgs.to),
            subject: str(args.fnArgs.subject),
            body: str(args.fnArgs.body),
            voice_call_id: args.callId,
          },
        })
      : args.name === "schedule_meeting"
        ? await createInboxItem({
            userId: args.ownerId,
            kind: "decision",
            title: `Meeting: ${str(args.fnArgs.with_who)} — ${str(args.fnArgs.when)}`,
            bodyMd: `Topic: ${str(args.fnArgs.topic)}\n\n${onCallLine}`,
            source: "voice-call",
            payload: { ...args.fnArgs, voice_call_id: args.callId },
          })
        : await createInboxItem({
            userId: args.ownerId,
            kind: "decision",
            title: `Follow up: ${str(args.fnArgs.about)}`,
            bodyMd: `${str(args.fnArgs.details)}\n\n${onCallLine}`.trim(),
            source: "voice-call",
            payload: { ...args.fnArgs, voice_call_id: args.callId },
          });

  if (!created.ok) {
    voiceLog.error("voice function-call staging failed", {
      callId: args.callId,
      name: args.name,
      status: created.status,
    });
    return null;
  }
  voiceLog.info("voice function call staged", {
    callId: args.callId,
    name: args.name,
    itemId: created.data.id,
  });
  return created.data.id;
}
