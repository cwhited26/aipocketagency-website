// connectors/deepgram/actions.ts — the Deepgram connector's action registry + the in-process
// executor the approval route calls (via lib/connectors/registry.ts) when the owner approves a
// staged transcription action (Meeting Persona, MP-CORE-2).
//
// One action, ALWAYS gated (never auto-approve eligible — SPEC §7 + MP-7):
//   • transcribe_meeting_live — start the live Deepgram transcription stream for a meeting session.
//
// Approving the action kicks off startTranscriptionStream (idempotent). The long-lived socket's
// runtime placement is MP-CORE-3's concern; this executor is the approve→start seam.

import { z } from "zod";
import { startTranscriptionStream } from "@/lib/meeting-persona/transcribe";
import {
  DEEPGRAM_CONNECTOR,
  type ApprovalGate,
  type DeepgramActionMeta,
  type DeepgramActionName,
} from "./types";

export { DEEPGRAM_CONNECTOR } from "./types";

const GATES: Record<DeepgramActionName, ApprovalGate> = {
  transcribe_meeting_live: "always_gated",
};

const DESCRIPTIONS: Record<DeepgramActionName, string> = {
  transcribe_meeting_live: "Start live Deepgram transcription for a meeting (always single-approval).",
};

export const DEEPGRAM_ACTIONS: readonly DeepgramActionMeta[] = (
  Object.keys(GATES) as DeepgramActionName[]
).map((action) => ({
  name: action,
  connector: DEEPGRAM_CONNECTOR,
  action,
  description: DESCRIPTIONS[action],
  gate: GATES[action],
}));

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isDeepgramAction(action: string): action is DeepgramActionName {
  return KNOWN_ACTIONS.has(action);
}

export function deepgramActionGate(action: DeepgramActionName): ApprovalGate {
  return GATES[action];
}

/** transcribe_meeting_live is always_gated → never auto-approve eligible (mirrors the recall_ai gates). */
export function isDeepgramNeverAutoApprove(action: DeepgramActionName): boolean {
  return GATES[action] === "always_gated";
}

// ── Executor ──────────────────────────────────────────────────────────────────────────────────────

export type DeepgramExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunDeepgramActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  ownerEmail?: string | null;
};

const TranscribeLiveInputSchema = z.object({
  session_id: z.string().min(1).max(200),
  recall_bot_id: z.string().min(1).max(200),
});

export async function executeDeepgramAction(
  input: RunDeepgramActionInput,
): Promise<DeepgramExecuteResult> {
  if (!isDeepgramAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Deepgram action: ${input.action}` };
  }
  const action: DeepgramActionName = input.action;
  // Only one action today; the switch keeps the never-typed exhaustiveness for when more land.
  switch (action) {
    case "transcribe_meeting_live": {
      const parsed = TranscribeLiveInputSchema.safeParse(input.payload);
      if (!parsed.success) return { ok: false, status: 422, error: parsed.error.message };
      const res = await startTranscriptionStream({
        sessionId: parsed.data.session_id,
        recallBotId: parsed.data.recall_bot_id,
      });
      if (!res.ok) return { ok: false, status: res.status, error: res.error };
      return {
        ok: true,
        summary: res.alreadyRunning
          ? `Transcription already running for session ${parsed.data.session_id}`
          : `Started transcription for session ${parsed.data.session_id} (audio: ${res.audioSource})`,
        data: { session_id: parsed.data.session_id, audio_source: res.audioSource, already_running: res.alreadyRunning },
      };
    }
    default: {
      const _never: never = action;
      return { ok: false, status: 400, error: `Unhandled Deepgram action: ${String(_never)}` };
    }
  }
}
