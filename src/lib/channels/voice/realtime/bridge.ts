// lib/channels/voice/realtime/bridge.ts — assembly for one live realtime call: resolve the call
// row, build Poc's instructions from the owner's Business Brain, wire every session dep
// (staging, event ledger, hangup, the speak-queue poll), and finalize on stop.
//
// The standalone WS service (docs/voice-call/handoff.md §v2) is deliberately thin: it adapts a
// Twilio Media Stream socket to VoiceSocket and an OpenAI socket to RealtimeSocket, then calls
// prepareRealtimeCall / finalizeRealtimeCall from here. All decisions live in the repo where the
// tests are; the service owns only transport.

import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchVoiceCallBySid, finalizeVoiceCall } from "../calls-store";
import { hangup as twilioHangup, TwilioError } from "../twilio";
import { openAiRealtimeKey, twilioEnv } from "../env";
import { voiceLog } from "../log";
import { buildPocRealtimeInstructions } from "./prompt";
import { isStagedFunctionName } from "./messages";
import { stageVoiceFunctionCall } from "./stage";
import { logRealtimeCallSummaryCost } from "./cost";
import {
  appendVoiceCallEvent,
  drainSpeakQueue,
  updateVoiceCallV2Fields,
} from "./events-store";
import type { RealtimeBridgeSession, RealtimeSessionDeps } from "./session";

/** The wss URL + auth header the service dials OpenAI with. */
export const REALTIME_WSS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime";

export function realtimeAuthHeaders(): Record<string, string> | null {
  const key = openAiRealtimeKey();
  if (!key) return null;
  return { Authorization: `Bearer ${key}` };
}

/** Best-effort owner display name for Poc's introductions. */
export async function resolveOwnerDisplayName(ownerId: string): Promise<string> {
  const res = await fetchPaUser(ownerId);
  if (res.ok && res.data && res.data.github_username.trim() !== "") {
    return res.data.github_username;
  }
  return "the owner";
}

/** A short Business Brain context block: the root-index doc titles the owner's brain carries. */
export async function resolveBusinessContext(ownerId: string): Promise<string> {
  const res = await fetchPaUser(ownerId);
  if (!res.ok || !res.data?.brain_root_index_json) return "";
  const titles: string[] = [];
  for (const entry of res.data.brain_root_index_json.slice(0, 15)) {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      const title = typeof rec.title === "string" ? rec.title : typeof rec.path === "string" ? rec.path : "";
      if (title !== "") titles.push(`- ${title}`);
    }
  }
  if (titles.length === 0) return "";
  return `The business's brain covers (titles only — say you'll check the brain for specifics):\n${titles.join("\n")}`;
}

export type PreparedRealtimeCall = {
  callId: string;
  ownerId: string;
  direction: "inbound" | "outbound";
  deps: RealtimeSessionDeps;
};

/**
 * Resolve everything a RealtimeBridgeSession needs for a connecting stream, from the CallSid the
 * TwiML handed the service. Null when the CallSid doesn't map to a live v2 call — the service
 * closes the stream without opening an OpenAI session.
 */
export async function prepareRealtimeCall(callSid: string): Promise<PreparedRealtimeCall | null> {
  const call = await fetchVoiceCallBySid(callSid);
  if (!call || call.engine !== "realtime_v2") {
    voiceLog.warn("realtime prepare — no v2 call for sid", { callSid });
    return null;
  }
  if (call.status !== "ringing" && call.status !== "in_progress") {
    voiceLog.warn("realtime prepare — call not live", { callSid, status: call.status });
    return null;
  }

  const [ownerName, businessContext] = await Promise.all([
    resolveOwnerDisplayName(call.owner_id),
    resolveBusinessContext(call.owner_id),
  ]);
  const instructions = buildPocRealtimeInstructions({
    direction: call.direction,
    ownerName,
    businessContext,
    purpose: call.purpose ?? undefined,
  });

  const deps: RealtimeSessionDeps = {
    instructions,
    openingResponse: true,
    async stageFunctionCall(name, args) {
      if (!isStagedFunctionName(name)) return null;
      return stageVoiceFunctionCall({
        ownerId: call.owner_id,
        callId: call.id,
        fromNumber: call.from_number,
        direction: call.direction,
        name,
        fnArgs: args,
      });
    },
    recordEvent(type, payload) {
      void appendVoiceCallEvent({ callId: call.id, ownerId: call.owner_id, eventType: type, payload });
    },
    async hangupCall(reason) {
      if (reason === "remote_close") return; // The caller hung up — nothing to end.
      const env = twilioEnv();
      if (!env) return;
      try {
        await twilioHangup({ accountSid: env.accountSid, authToken: env.authToken }, callSid);
      } catch (err) {
        if (!(err instanceof TwilioError)) throw err;
        voiceLog.error("cap hangup failed", { callSid, status: err.status });
      }
    },
    pollOwnerLines:
      call.direction === "outbound"
        ? () => drainSpeakQueue({ callId: call.id, ownerId: call.owner_id })
        : undefined,
  };

  return { callId: call.id, ownerId: call.owner_id, direction: call.direction, deps };
}

/**
 * Persist a finished session: structured transcript + staged calls onto the row, the realized
 * realtime cost into pa_cost_events (featureSlug 'voice_call' — Credits + Top Ups meter it), and
 * the final status. The Twilio status callback may also finalize; the summary cost idempotency
 * key collapses the ledger to one row and this exact write wins when it lands first.
 */
export async function finalizeRealtimeCall(args: {
  callSid: string;
  ownerId: string;
  session: RealtimeBridgeSession;
}): Promise<void> {
  const { session } = args;
  const costCents = await logRealtimeCallSummaryCost({
    ownerId: args.ownerId,
    callSid: args.callSid,
    microCents: session.cost.microCents,
  });
  await updateVoiceCallV2Fields({
    callSid: args.callSid,
    transcript: session.transcript,
    functionCalls: session.stagedCalls,
  });
  await finalizeVoiceCall({
    callSid: args.callSid,
    status: "completed",
    endedAt: new Date().toISOString(),
    durationSeconds: Math.round(session.elapsedSeconds),
    costCents,
    transcriptFull: session.transcript.map((t) => `${t.role}: ${t.text}`).join("\n"),
    hangupReason: session.capReason ?? "hangup",
  });
}
