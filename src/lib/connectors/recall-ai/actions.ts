// connectors/recall-ai/actions.ts — the Recall.ai connector's action registry + the in-process
// executor the approval route calls (via lib/connectors/registry.ts) the moment the owner approves a
// staged meeting action (Meeting Persona, MP-CORE-1).
//
// Three actions, all ALWAYS gated — they NEVER become auto-approve eligible regardless of success
// count (SPEC §7 trust ladder + MP-7):
//   • spawn_meeting_bot        — send a bot into a live meeting (joins as a participant; privacy-/
//                                consent-sensitive). Also opens the session ledger row.
//   • leave_meeting_bot        — pull the bot out of a meeting.
//   • fetch_meeting_transcript — pull the meeting transcript.
//
// Direct REST against the Recall API (./client.ts), no SDK. The owner's API key is decrypted from
// the connection row HERE, on each call, and never leaves this process.

import { z } from "zod";
import {
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { decryptRecallKey, RecallKeyDecryptionError } from "@/lib/crypto/recall-key";
import {
  fetchRecallConnectionFull,
  insertMeetingSession,
} from "./db";
import { getTranscript, inferMeetingProvider, leaveBot, spawnBot } from "./client";
import { log } from "./log";
import {
  BotIdInputSchema,
  RECALL_AI_CONNECTOR,
  SpawnBotInputSchema,
  type ActionExecOutcome,
  type ApprovalGate,
  type RecallAiActionMeta,
  type RecallAiActionName,
} from "./types";

export { RECALL_AI_CONNECTOR } from "./types";

// ── Per-action gates (all always_gated) ──────────────────────────────────────────────────────────
const GATES: Record<RecallAiActionName, ApprovalGate> = {
  spawn_meeting_bot: "always_gated",
  leave_meeting_bot: "always_gated",
  fetch_meeting_transcript: "always_gated",
};

const DESCRIPTIONS: Record<RecallAiActionName, string> = {
  spawn_meeting_bot: "Send the Persona's bot into a Zoom/Meet/Teams meeting (always single-approval).",
  leave_meeting_bot: "Remove the Persona's bot from a meeting (always single-approval).",
  fetch_meeting_transcript: "Fetch a meeting's transcript from Recall.ai (always single-approval).",
};

export const RECALL_AI_ACTIONS: readonly RecallAiActionMeta[] = (
  Object.keys(GATES) as RecallAiActionName[]
).map((action) => ({
  name: action,
  connector: RECALL_AI_CONNECTOR,
  action,
  description: DESCRIPTIONS[action],
  gate: GATES[action],
}));

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isRecallAiAction(action: string): action is RecallAiActionName {
  return KNOWN_ACTIONS.has(action);
}

export function recallAiActionGate(action: RecallAiActionName): ApprovalGate {
  return GATES[action];
}

/**
 * Every Recall.ai action is always_gated → none can ever become auto-approve eligible, regardless of
 * approval count. Sending a bot into a live call, pulling it, and reading a transcript are each
 * material / privacy-sensitive (SPEC §7 + MP-7). Mirrors isGithubBuildNeverAutoApprove.
 */
export function isRecallAiNeverAutoApprove(action: RecallAiActionName): boolean {
  return GATES[action] === "always_gated";
}

// ── Executor ──────────────────────────────────────────────────────────────────────────────────────

export type RecallAiExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunRecallAiActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  ownerEmail?: string | null;
};

async function executeCore(
  action: RecallAiActionName,
  apiKey: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ActionExecOutcome> {
  switch (action) {
    case "spawn_meeting_bot": {
      const parsed = SpawnBotInputSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, status: 422, error: parsed.error.message, authError: false };
      const res = await spawnBot({ ...parsed.data, apiKey });
      if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

      // Open the session ledger so the webhook can resolve this meeting by recall_bot_id.
      const inserted = await insertMeetingSession({
        ownerId: userId,
        recallBotId: res.data.id,
        meetingUrl: parsed.data.meetingUrl,
        meetingProvider: inferMeetingProvider(parsed.data.meetingUrl),
        status: "joining",
        botMetadata: {
          recording_mode: parsed.data.recordingMode,
          ...(parsed.data.botName ? { bot_name: parsed.data.botName } : {}),
        },
      });
      if (!inserted.ok) {
        // The bot is live but the ledger row failed — surface it (never silently drop) so the owner
        // can see the meeting won't be tracked. The webhook can't resolve a session that isn't there.
        log.error("spawn_meeting_bot: session ledger insert failed", {
          recall_bot_id: res.data.id,
          status: inserted.status,
          error: inserted.error,
        });
        return {
          ok: false,
          status: 502,
          error: `Bot ${res.data.id} joined, but the meeting could not be recorded in your workspace (${inserted.error}).`,
          authError: false,
        };
      }
      return {
        ok: true,
        summary: `Sent bot to meeting (${parsed.data.recordingMode}) → bot ${res.data.id}`,
        data: { recall_bot_id: res.data.id, session_id: inserted.data.id },
      };
    }
    case "leave_meeting_bot": {
      const parsed = BotIdInputSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, status: 422, error: parsed.error.message, authError: false };
      const res = await leaveBot({ botId: parsed.data.botId, apiKey });
      if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };
      return { ok: true, summary: `Bot ${parsed.data.botId} left the meeting`, data: { recall_bot_id: parsed.data.botId } };
    }
    case "fetch_meeting_transcript": {
      const parsed = BotIdInputSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, status: 422, error: parsed.error.message, authError: false };
      const res = await getTranscript({ botId: parsed.data.botId, apiKey });
      if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };
      return {
        ok: true,
        summary: `Fetched transcript for bot ${parsed.data.botId} (${res.data.length} segments)`,
        data: { recall_bot_id: parsed.data.botId, segment_count: res.data.length },
      };
    }
    default: {
      const _never: never = action;
      return { ok: false, status: 400, error: `Unknown recall_ai action: ${String(_never)}`, authError: false };
    }
  }
}

export async function executeRecallAiAction(
  input: RunRecallAiActionInput,
): Promise<RecallAiExecuteResult> {
  if (!isRecallAiAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Recall.ai action: ${input.action}` };
  }
  const action = input.action;

  const conn = await fetchRecallConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data) {
    return {
      ok: false,
      status: 409,
      error: "Connect Recall.ai in Settings → Connections before running meeting actions.",
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptRecallKey(conn.data.apiKeyEncrypted);
  } catch (e) {
    if (e instanceof RecallKeyDecryptionError) {
      return {
        ok: false,
        status: 401,
        error: "Recall.ai key unreadable — reconnect Recall.ai in Settings → Connections.",
      };
    }
    throw e;
  }

  const outcome = await executeCore(action, apiKey, input.userId, input.payload);

  await logExecuted(input, action, outcome.ok ? "executed" : "failed", outcome.ok ? outcome.summary : outcome.error);

  if (!outcome.ok) {
    if (outcome.authError) {
      return {
        ok: false,
        status: 401,
        error: "Recall.ai rejected the key — reconnect Recall.ai in Settings → Connections.",
      };
    }
    return { ok: false, status: outcome.status, error: outcome.error };
  }
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Audit-log the terminal outcome. Best-effort: a missing audit table (migration not applied) must
// not fail an otherwise-successful action.
async function logExecuted(
  input: RunRecallAiActionInput,
  action: RecallAiActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: RECALL_AI_CONNECTOR,
      action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
