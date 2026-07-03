// lib/channels/voice/env.ts — typed, validated access to the Voice Call server env (spec §env-vars).
// All server-only; never exposed to the client. Routes read these and 503 cleanly when unconfigured
// rather than throwing a raw ReferenceError. The feature flag (feature-flag.ts) gates separately.

export type TwilioEnv = {
  accountSid: string;
  authToken: string;
  /** The shared-pool DID lower tiers call (spec §setup trial flow). May be empty if no pool set up. */
  sharedPoolNumber: string;
};

/** Twilio account creds + the shared pool number, or null if SID/token aren't both set. */
export function twilioEnv(): TwilioEnv | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authToken,
    sharedPoolNumber: process.env.TWILIO_SHARED_POOL_NUMBER ?? "",
  };
}

/** The ElevenLabs API key (streaming TTS), or null if unset. */
export function elevenLabsApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY ?? null;
}

/** The OpenAI API key used for Whisper transcription, or null if unset. */
export function whisperApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * The public origin webhooks + the Media Stream WS are built from. Reuses PA_OAUTH_REDIRECT_BASE
 * (the same base the Slack channel uses) so there's one place to point at prod. Defaults to the public
 * site. Trailing slash stripped.
 */
export function publicWebhookBase(): string {
  const base = process.env.PA_OAUTH_REDIRECT_BASE ?? "https://aipocketagent.com";
  return base.replace(/\/$/, "");
}

/**
 * Voice v2: the OpenAI key the realtime bridge authenticates with. A dedicated
 * OPENAI_REALTIME_API_KEY wins (lets Chase scope realtime spend separately); falls back to the
 * OPENAI_API_KEY already set for Whisper.
 */
export function openAiRealtimeKey(): string | null {
  return process.env.OPENAI_REALTIME_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}

/**
 * Voice v2: the voice-enabled DID outbound calls originate from (and the default inbound line).
 * Distinct from TWILIO_SHARED_POOL_NUMBER so the v1 pipeline pool and the v2 realtime line can be
 * different numbers during rollout.
 */
export function twilioVoiceNumber(): string | null {
  return process.env.TWILIO_VOICE_PHONE_NUMBER ?? null;
}

/** Voice v2: the wss:// origin for the realtime bridge. Falls back to the v1 stream service. */
export function voiceRealtimeWsBase(): string {
  const explicit = process.env.PA_VOICE_REALTIME_WSS_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return voiceStreamWsBase();
}

/** The wss:// origin for the Twilio Media Stream (the standalone WS service, spec build-step 6). */
export function voiceStreamWsBase(): string {
  // The standalone WS service runs at its own origin; default derives from the webhook base by
  // swapping the scheme to wss and pointing at the /voice-stream path the service listens on.
  const explicit = process.env.PA_VOICE_STREAM_WSS_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return publicWebhookBase().replace(/^http/, "ws") + "/voice-stream";
}
