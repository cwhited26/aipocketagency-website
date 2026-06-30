// lib/channels/voice/connection.ts — the voice connection layer over pa_channel_connections (one row
// per owner, channel_slug='voice'). Holds the provisioned DID (external_id), the AES-256-GCM-encrypted
// Twilio Auth Token (auth_token_encrypted, via the channels store), and the voice config jsonb. Wraps
// the generic channels store so the voice routes work in voice terms (number, voice id, greeting, cap).

import {
  deleteChannelConnection,
  fetchChannelConnectionForOwner,
  fetchOwnerChannelConnectionFull,
  upsertChannelConnection,
} from "@/lib/channels/store";
import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { DEFAULT_VOICE_ID } from "./catalog";

/** The voice-specific knobs stored in pa_channel_connections.config for a 'voice' connection. */
export type VoiceConnectionConfig = {
  /** Twilio Account SID the number lives under (PA's account). */
  accountSid: string;
  /** ElevenLabs voice id this connection answers in (the picker / custom Studio+ id). */
  voiceId: string;
  /** "own" = the owner provisioned their own number; "shared" = the PA shared pool number. */
  pool: "own" | "shared";
  /** The IncomingPhoneNumber SID (own-number only) — for re-pointing the webhook / release. */
  numberSid: string | null;
  /** Per-call max in seconds (own-number owners); null = use the shared-pool trial cap. */
  maxCallSeconds: number | null;
  /** Shared-pool only: the owner's phone, resolved on inbound by caller ID. Null for own-number. */
  callerNumber: string | null;
};

function parseConfig(raw: Record<string, unknown>): VoiceConnectionConfig {
  const str = (v: unknown, d: string): string => (typeof v === "string" && v !== "" ? v : d);
  const poolRaw = raw.pool;
  const numberSid = typeof raw.number_sid === "string" ? raw.number_sid : null;
  const maxCall =
    typeof raw.max_call_seconds === "number" && Number.isFinite(raw.max_call_seconds)
      ? raw.max_call_seconds
      : null;
  return {
    accountSid: str(raw.account_sid, ""),
    voiceId: str(raw.voice_id, DEFAULT_VOICE_ID),
    pool: poolRaw === "own" ? "own" : "shared",
    numberSid,
    maxCallSeconds: maxCall,
    callerNumber: typeof raw.caller_number === "string" ? raw.caller_number : null,
  };
}

function serializeConfig(config: VoiceConnectionConfig): Record<string, unknown> {
  return {
    account_sid: config.accountSid,
    voice_id: config.voiceId,
    pool: config.pool,
    number_sid: config.numberSid,
    max_call_seconds: config.maxCallSeconds,
    caller_number: config.callerNumber,
  };
}

export type VoiceConnectionPublic = {
  connected: boolean;
  enabled: boolean;
  phoneNumber: string | null;
  personaId: string | null;
  config: VoiceConnectionConfig | null;
};

/** The owner's voice connection as the settings surface reads it (no token). */
export async function getVoiceConnection(ownerId: string): Promise<VoiceConnectionPublic> {
  const res = await fetchChannelConnectionForOwner(ownerId, "voice");
  if (!res.ok || !res.data) {
    return { connected: false, enabled: false, phoneNumber: null, personaId: null, config: null };
  }
  return {
    connected: true,
    enabled: res.data.enabled,
    phoneNumber: res.data.externalId,
    personaId: res.data.personaId,
    config: parseConfig(res.data.config),
  };
}

export type VoiceConnectionFull = {
  phoneNumber: string;
  personaId: string | null;
  /** The decrypted Twilio Auth Token for this connection (signature verify + API calls). */
  authToken: string | null;
  config: VoiceConnectionConfig;
};

/** The owner's voice connection with the decrypted token — used by the answer + status routes. */
export async function getVoiceConnectionFull(ownerId: string): Promise<VoiceConnectionFull | null> {
  const res = await fetchOwnerChannelConnectionFull(ownerId, "voice");
  if (!res.ok || !res.data) return null;
  return {
    phoneNumber: res.data.externalId,
    personaId: res.data.personaId,
    authToken: res.data.authToken,
    config: parseConfig(res.data.config),
  };
}

/**
 * Upsert the owner's voice connection. The Twilio Auth Token is encrypted by the channels store before
 * it touches the DB (auth_token_encrypted). personaId, when provided, sets which Persona answers.
 */
export async function saveVoiceConnection(params: {
  ownerId: string;
  phoneNumber: string;
  authToken: string;
  config: VoiceConnectionConfig;
  personaId?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await upsertChannelConnection({
    ownerId: params.ownerId,
    channelSlug: "voice",
    externalId: params.phoneNumber,
    authToken: params.authToken,
    config: serializeConfig(params.config),
    personaId: params.personaId,
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return { ok: true };
}

/** Disconnect the owner's voice channel (deletes the connection row). */
export async function removeVoiceConnection(ownerId: string): Promise<boolean> {
  const res = await deleteChannelConnection(ownerId, "voice");
  return res.ok;
}

// ── Shared-pool caller resolution ───────────────────────────────────────────────────────────
//
// A shared-pool DID (one number, many owners) can't carry ?owner= in its webhook URL, so the answer
// route resolves the owner by the CALLER's number (config.caller_number, captured at provision time
// and SMS-verified via the test-call flow). Own-number owners use ?owner= and never hit this path.

export type ResolvedVoiceOwner = {
  ownerId: string;
  personaId: string | null;
  authToken: string | null;
  config: VoiceConnectionConfig;
};

function poolEnv(): { url: string; key: string } | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Resolve a shared-pool owner by the caller's number. Matches a 'voice' connection whose config
 * caller_number equals `callerNumber` and pool is 'shared'. Returns null when no match (an unknown
 * caller on the shared pool — the answer route hangs up).
 */
export async function resolveSharedVoiceOwnerByCaller(
  callerNumber: string,
): Promise<ResolvedVoiceOwner | null> {
  const env = poolEnv();
  if (!env) return null;
  const endpoint =
    `${env.url}/rest/v1/pa_channel_connections` +
    `?channel_slug=eq.voice` +
    `&config->>caller_number=eq.${encodeURIComponent(callerNumber)}` +
    `&config->>pool=eq.shared&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as {
    owner_id: string;
    persona_id: string | null;
    auth_token_encrypted: string | null;
    config: Record<string, unknown> | null;
  }[];
  const row = rows[0];
  if (!row) return null;
  let authToken: string | null = null;
  if (row.auth_token_encrypted) {
    try {
      authToken = decrypt(row.auth_token_encrypted);
    } catch (err) {
      if (!(err instanceof DecryptionError)) throw err;
    }
  }
  return {
    ownerId: row.owner_id,
    personaId: row.persona_id,
    authToken,
    config: parseConfig(row.config ?? {}),
  };
}
