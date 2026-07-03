// lib/channels/voice/realtime/events-store.ts — persistence for pa_voice_call_events (migration
// 104) + the v2 columns on pa_voice_calls. Service-role REST, no SDK — the calls-store.ts pattern
// verbatim. Writers are the realtime bridge + the app API routes (both behind auth/signature
// checks); the owner reads via RLS on the detail page.

import { voiceLog } from "../log";
import type { StagedCall, TranscriptTurn } from "./session";

const EVENTS_TABLE = "pa_voice_call_events";
const CALLS_TABLE = "pa_voice_calls";

type Env = { url: string; key: string } | { error: string };

function paEnv(): Env {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export type VoiceCallEventType =
  | "speech"
  | "function_call"
  | "approval_request"
  | "approval_response"
  | "speak_queue";

export type VoiceCallEventRow = {
  id: string;
  call_id: string;
  owner_id: string;
  event_type: VoiceCallEventType;
  payload: Record<string, unknown>;
  created_at: string;
};

/** Append one event. Best-effort — a ledger hiccup never breaks a live call. */
export async function appendVoiceCallEvent(params: {
  callId: string;
  ownerId: string;
  eventType: VoiceCallEventType;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) {
    voiceLog.warn("voice call event not recorded — service-role env unset", { callId: params.callId });
    return null;
  }
  const res = await fetch(`${env.url}/rest/v1/${EVENTS_TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      call_id: params.callId,
      owner_id: params.ownerId,
      event_type: params.eventType,
      payload: params.payload,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    voiceLog.error("voice call event append failed", { callId: params.callId, status: res.status });
    return null;
  }
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

/** All events for one call, oldest-first (the live transcript poll + the detail page). */
export async function listVoiceCallEvents(params: {
  callId: string;
  ownerId: string;
  sinceIso?: string;
}): Promise<VoiceCallEventRow[]> {
  const env = paEnv();
  if ("error" in env) return [];
  let endpoint =
    `${env.url}/rest/v1/${EVENTS_TABLE}` +
    `?call_id=eq.${encodeURIComponent(params.callId)}` +
    `&owner_id=eq.${encodeURIComponent(params.ownerId)}` +
    `&order=created_at.asc`;
  if (params.sinceIso) endpoint += `&created_at=gt.${encodeURIComponent(params.sinceIso)}`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    voiceLog.warn("voice call events query failed", { callId: params.callId, status: res.status });
    return [];
  }
  return (await res.json()) as VoiceCallEventRow[];
}

/**
 * The speak-as-Poc queue (outbound listen-in): the owner types a line, the bridge polls, delivers,
 * and marks it consumed. Consumption is a payload flip so the ledger stays append-only in spirit —
 * the row itself is the audit record of what the owner fed Poc.
 */
export async function drainSpeakQueue(params: {
  callId: string;
  ownerId: string;
}): Promise<string[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const endpoint =
    `${env.url}/rest/v1/${EVENTS_TABLE}` +
    `?call_id=eq.${encodeURIComponent(params.callId)}` +
    `&owner_id=eq.${encodeURIComponent(params.ownerId)}` +
    `&event_type=eq.speak_queue` +
    `&payload->>consumed=eq.false` +
    `&order=created_at.asc`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return [];
  const rows = (await res.json()) as VoiceCallEventRow[];

  const lines: string[] = [];
  for (const row of rows) {
    const text = typeof row.payload.text === "string" ? row.payload.text : "";
    if (text.trim() === "") continue;
    const patch = await fetch(`${env.url}/rest/v1/${EVENTS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { ...row.payload, consumed: true } }),
      cache: "no-store",
    });
    if (!patch.ok) {
      voiceLog.warn("speak queue consume failed", { eventId: row.id, status: patch.status });
      continue; // Not consumed → it will re-deliver next poll rather than silently dropping.
    }
    lines.push(text);
  }
  return lines;
}

/** Patch the v2 columns on a call row (transcript_json, function_calls, engine, purpose). */
export async function updateVoiceCallV2Fields(params: {
  callSid: string;
  transcript?: readonly TranscriptTurn[];
  functionCalls?: readonly StagedCall[];
  engine?: "pipeline_v1" | "realtime_v2";
  purpose?: string;
}): Promise<boolean> {
  const env = paEnv();
  if ("error" in env) return false;
  const patch: Record<string, unknown> = {};
  if (params.transcript !== undefined) {
    patch.transcript_json = params.transcript.map((t) => ({
      role: t.role,
      text: t.text,
      at_ms: t.atMs,
    }));
  }
  if (params.functionCalls !== undefined) {
    patch.function_calls = params.functionCalls.map((c) => ({
      name: c.name,
      arguments: c.args,
      staged_action_id: c.stagedActionId,
      outcome: c.outcome,
    }));
  }
  if (params.engine !== undefined) patch.engine = params.engine;
  if (params.purpose !== undefined) patch.purpose = params.purpose;
  if (Object.keys(patch).length === 0) return true;

  const res = await fetch(
    `${env.url}/rest/v1/${CALLS_TABLE}?twilio_call_sid=eq.${encodeURIComponent(params.callSid)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    voiceLog.error("voice call v2 patch failed", { callSid: params.callSid, status: res.status });
    return false;
  }
  return true;
}

/** Count an owner's calls started since an ISO timestamp (the daily call cap basis). */
export async function countVoiceCallsSince(ownerId: string, sinceIso: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;
  const endpoint =
    `${env.url}/rest/v1/${CALLS_TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&started_at=gte.${encodeURIComponent(sinceIso)}` +
    `&select=id`;
  const res = await fetch(endpoint, {
    headers: { ...authHeaders(env.key), Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
  });
  if (!res.ok) {
    voiceLog.warn("voice daily count query failed", { ownerId, status: res.status });
    return 0;
  }
  const contentRange = res.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  const parsed = total ? Number.parseInt(total, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}
