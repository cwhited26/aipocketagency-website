// lib/channels/voice/calls-store.ts — persistence for pa_voice_calls (migration 091). Service-role
// REST, no SDK — matching lib/channels/store.ts. One row per call: created on answer (status webhook
// 'ringing'/'in_progress'), finalized on completion (duration, transcript, cost). Owner-scoped RLS
// lets the settings surface read; writes go through the service-role key here.

import { voiceLog } from "./log";

const TABLE = "pa_voice_calls";

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

export type VoiceCallStatus = "ringing" | "in_progress" | "completed" | "failed" | "no_answer";

export type VoiceCallRow = {
  id: string;
  owner_id: string;
  persona_id: string | null;
  twilio_call_sid: string;
  from_number: string;
  to_number: string;
  direction: "inbound" | "outbound";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript_full: string | null;
  cost_cents: number | null;
  status: VoiceCallStatus;
  hangup_reason: string | null;
  untrusted_origin: boolean;
  created_at: string;
  // Voice v2 columns (migration 104). Null on pre-v2 rows and on a DB the migration hasn't
  // reached yet — every reader treats null as "v1 pipeline call".
  transcript_json: { role: string; text: string; at_ms: number }[] | null;
  function_calls:
    | { name: string; arguments: Record<string, unknown>; staged_action_id: string | null; outcome: string }[]
    | null;
  engine: "pipeline_v1" | "realtime_v2" | null;
  purpose: string | null;
};

/** One call by row id, owner-scoped (the /app/apps/voice detail page + its API). */
export async function fetchVoiceCallById(id: string, ownerId: string): Promise<VoiceCallRow | null> {
  const env = paEnv();
  if ("error" in env) return null;
  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as VoiceCallRow[];
  return rows[0] ?? null;
}

/**
 * Upsert a voice-call row keyed on twilio_call_sid (idempotent — a retried 'ringing'/'in_progress'
 * callback merges in place). Best-effort: a failed write is logged and returns null rather than
 * throwing, so a forensics hiccup never breaks the live call.
 */
export async function upsertVoiceCall(params: {
  ownerId: string;
  personaId: string | null;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  status: VoiceCallStatus;
}): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) {
    voiceLog.warn("voice call not recorded — service-role env unset", { callSid: params.callSid });
    return null;
  }
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=twilio_call_sid`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      owner_id: params.ownerId,
      persona_id: params.personaId,
      twilio_call_sid: params.callSid,
      from_number: params.fromNumber,
      to_number: params.toNumber,
      direction: params.direction,
      status: params.status,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    voiceLog.error("voice call upsert failed", { callSid: params.callSid, status: res.status });
    return null;
  }
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

/** Finalize a call on completion: status + duration + cost + transcript + hangup reason, by CallSid. */
export async function finalizeVoiceCall(params: {
  callSid: string;
  status: VoiceCallStatus;
  endedAt?: string;
  durationSeconds?: number | null;
  costCents?: number | null;
  transcriptFull?: string | null;
  hangupReason?: string | null;
}): Promise<boolean> {
  const env = paEnv();
  if ("error" in env) return false;
  const patch: Record<string, unknown> = { status: params.status };
  if (params.endedAt !== undefined) patch.ended_at = params.endedAt;
  if (params.durationSeconds !== undefined) patch.duration_seconds = params.durationSeconds;
  if (params.costCents !== undefined) patch.cost_cents = params.costCents;
  if (params.transcriptFull !== undefined) patch.transcript_full = params.transcriptFull;
  if (params.hangupReason !== undefined) patch.hangup_reason = params.hangupReason;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?twilio_call_sid=eq.${encodeURIComponent(params.callSid)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    voiceLog.error("voice call finalize failed", { callSid: params.callSid, status: res.status });
    return false;
  }
  return true;
}

/** Sum completed-call duration_seconds for an owner since an ISO timestamp (for the minute caps). */
export async function sumVoiceSecondsSince(ownerId: string, sinceIso: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;
  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&started_at=gte.${encodeURIComponent(sinceIso)}` +
    `&select=duration_seconds`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    voiceLog.warn("voice usage sum query failed", { ownerId, status: res.status });
    return 0;
  }
  const rows = (await res.json()) as { duration_seconds: number | null }[];
  return rows.reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0);
}

/** Recent calls for the usage chart (newest-first), owner-scoped. */
export async function listRecentVoiceCalls(ownerId: string, limit = 50): Promise<VoiceCallRow[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=started_at.desc&limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    voiceLog.warn("voice recent-calls query failed", { ownerId, status: res.status });
    return [];
  }
  return (await res.json()) as VoiceCallRow[];
}

/** Look up the owner + persona behind a provisioned Twilio number (the To on an inbound call). */
export async function fetchVoiceCallBySid(callSid: string): Promise<VoiceCallRow | null> {
  const env = paEnv();
  if ("error" in env) return null;
  const endpoint =
    `${env.url}/rest/v1/${TABLE}?twilio_call_sid=eq.${encodeURIComponent(callSid)}&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as VoiceCallRow[];
  return rows[0] ?? null;
}
