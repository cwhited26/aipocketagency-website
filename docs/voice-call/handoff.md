# Voice Call channel — handoff (Channels Gateway Phase 6, v0.1)

Inbound phone → owner's Persona → spoken reply, looping until hangup. Ships **behind the
`PA_VOICE_CALL_ENABLED` flag (default OFF)**. Spec:
`whited-brain/APA/Products/Pocket_Agent_Voice_Call_Channel_SPEC_v1.md`.

## What shipped

- **Migration `094_voice_call_channel.sql`** — `personas.voice_profile_json jsonb default '{}'`
  (nullable), and the `pa_voice_calls` table (owner-scoped RLS, service-role writes). No
  `channel_slug` CHECK to widen — that column is plain `text` (see 074), so `'voice'` is already
  accepted; the closed slug set lives in code (`src/lib/channels/types.ts`).
- **Twilio adapter** `src/lib/channels/voice/twilio.ts` — `provisionNumber`, `updateVoiceWebhook`,
  `hangup`, `placeTestCall`, `verifyTwilioSignature` (HMAC-SHA1). Direct REST, no SDK.
- **Pipeline** `src/lib/channels/voice/` — `audio.ts` (µ-law↔PCM, silence detector), `stt.ts`
  (Whisper batching), `tts.ts` (ElevenLabs synth + downsample→µ-law + Twilio framing),
  `dispatcher-voice.ts` (read-only-default policy + confirm-send unlock), `stream-loop.ts`
  (the STT→dispatcher→TTS `VoiceCallSession` over an abstract `VoiceSocket`).
- **Routes** `src/app/api/channels/voice/` — `twiml` (answer + Connect/Stream TwiML), `stream`
  (426 diagnostic — see below), `status` (finalize + cost), plus `provision` / `persona` /
  `test-call` / `disconnect` for the setup surface.
- **Setup surface** `/app/settings/voice` — persona picker, 12-voice catalog (+ custom id for
  Studio+), own-number vs shared-pool, test-call button, minute-usage chart.
- **Tier gating** `src/lib/tiers/voice.ts` — 10 / 60 / 300 / unlimited min per month; 60-min/day
  cap on the unlimited tiers; own-number = Pro+ ; custom voice id = Studio+.
- **Cost** — per-turn dispatcher LLM rows (`voice_call` / `anthropic`) + one per-call summary row
  (`voice_call` / `twilio+elevenlabs+openai`) with `metadata.cost_breakdown`.

## The WebSocket caveat (important)

Twilio Media Streams need a **persistent bidirectional WebSocket**, which Vercel
serverless/Fluid functions cannot host, and the `ws` package is not in this repo. So the
STT→dispatcher→TTS loop is written against a transport-agnostic `VoiceSocket` interface
(`stream-loop.ts`) and **runs in a separate long-lived Node service**. The TwiML answer route
points Twilio's `<Stream url>` at `PA_VOICE_STREAM_WSS_URL`, not at `/api/channels/voice/stream`
(which returns a `426` diagnostic if hit directly).

Standalone-service sketch (deploy on Fly/Render/Railway/a container — anywhere that allows a
long-lived socket; `pnpm add ws` there):

```ts
import { WebSocketServer } from "ws";
import { VoiceCallSession, type VoiceSocket } from "@/lib/channels/voice/stream-loop";
import { VoiceTranscriber, whisperTranscribe } from "@/lib/channels/voice/stt";
import { speak, elevenLabsSynthesize } from "@/lib/channels/voice/tts";
import { handleVoiceTurn, initialVoiceTurnState } from "@/lib/channels/voice/dispatcher-voice";
// resolve owner/persona/voiceProfile/ceiling from ?owner=&callSid= on the WS upgrade URL,
// then adapt the Twilio media protocol (start/media/stop JSON frames) to VoiceSocket and:
//   const session = new VoiceCallSession(voiceSocket, { transcriber, speak, handleTurn, ceilingSeconds, greeting });
//   await session.start();
// On stop, finalize the pa_voice_calls row (finalizeVoiceCall) with session.transcript + durations.
```

## Chase — Vercel env vars to set (production + preview)

| Var | Value |
|---|---|
| `PA_VOICE_CALL_ENABLED` | leave UNSET until tested; then `true` |
| `TWILIO_ACCOUNT_SID` | PA's Twilio account SID (already used for SMS — unprefixed pair) |
| `TWILIO_AUTH_TOKEN` | PA's Twilio auth token |
| `TWILIO_SHARED_POOL_NUMBER` | the E.164 shared-pool DID (after the Twilio setup below) |
| `ELEVENLABS_API_KEY` | ElevenLabs key with streaming TTS access |
| `OPENAI_API_KEY` | already set (Whisper) — confirm present |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | already set — reused to encrypt the Twilio token at rest |
| `PA_VOICE_STREAM_WSS_URL` | the standalone WS service origin, e.g. `wss://voice.aipocketagent.com/voice-stream` |

No secrets in this file or in chat.

## Twilio account setup

1. **Provision a parent number for the shared pool** — buy one US local number in the Twilio
   console; set its Voice webhook to `https://aipocketagent.com/api/channels/voice/twiml` (POST,
   no `?owner=` — shared-pool callers resolve by caller ID) and its status callback to
   `https://aipocketagent.com/api/channels/voice/status`. Put the number in
   `TWILIO_SHARED_POOL_NUMBER`.
2. **Enable Media Streams** — Media Streams are on by default for Programmable Voice; confirm the
   account isn't restricted. The TwiML we return opens `<Connect><Stream>` to
   `PA_VOICE_STREAM_WSS_URL`.
3. Own-number provisioning (Pro+) happens automatically from `/app/settings/voice` via the API;
   the webhook is auto-pointed at `/api/channels/voice/twiml?owner=<id>`.

## ElevenLabs setup

- Create an **API key with streaming TTS access**; set `ELEVENLABS_API_KEY`. The 12 catalog
  voices are first-party default voice ids (no extra setup). Studio+ owners can paste a custom
  voice id from their own ElevenLabs library.

## Migration

`supabase/migrations/094_voice_call_channel.sql` — additive, idempotent. **Apply to the PA project
`haizcnyywvewjygzeaaf`** (this session had no connected SQL tool, so it is PENDING — apply via the
Supabase MCP / dashboard).

## v0.1 limitations (documented, not gaps to hide)

- The WS loop runs as a separate service (above); `/api/channels/voice/stream` is a diagnostic.
- "confirm send" unlocks execution for the rest of the call; binding the phrase to a *specific*
  already-staged action ("one phrase, one execution") is v1.5 — until then the caller re-states
  the action while unlocked.
- Shared-pool inbound resolves the owner by caller ID (`config.caller_number`); SMS-verifying that
  number is the test-call step / a v1.5 hardening.
- No outbound calls except the bounded test-call to the owner's own number (spec defers outbound
  to v1.5). No audio recording — transcripts only.
- The status-callback cost is priced from billed call duration (caller/agent audio split ~50/50);
  the WS service can finalize with exact per-segment seconds when wired.
