// lib/channels/voice/feature-flag.ts — the Voice Call channel master switch (PA-VOICE v0.1).
//
// Default OFF. The flag stays off until the Twilio + ElevenLabs + OpenAI env vars are set and the
// channel has been tested end-to-end via the /app/settings/voice test-call button. Every voice route
// + the setup surface gate on this so a half-configured deploy can't take real inbound calls. Mirrors
// the orchestrator/persona feature-flag pattern (process.env.PA_*_ENABLED === "true").

export function voiceCallEnabled(): boolean {
  return process.env.PA_VOICE_CALL_ENABLED === "true";
}

/**
 * Voice v2 (PA-CHAN-15/16): the realtime engine switch — inbound answer via /api/channels/inbound/
 * voice, outbound calls, the /app/apps/voice App. Independent of the v1 pipeline flag so the two
 * engines can be tested and rolled out separately. Default OFF.
 */
export function voiceRealtimeEnabled(): boolean {
  return process.env.PA_VOICE_REALTIME_ENABLED === "true";
}
