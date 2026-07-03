# Voice Call channel — handoff (Channels Gateway Phase 6, v0.1 + Voice v2 realtime)

> **Voice v2 (PA-CHAN-15/16) shipped on top of this.** The realtime engine — Poc answers the phone
> AND makes outbound calls, OpenAI Realtime instead of the Whisper→dispatcher→ElevenLabs pipeline —
> is documented in the **Voice v2** section at the bottom. v0.1 below still describes the pipeline
> engine, which stays behind its own flag.

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
//   greeting = voiceIntroLine(voiceProfile, getPersonaDisplayName(persona))  // lib/channels/voice/profile.ts (PA-POS-35)
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

---

## Voice v2 — realtime engine (PA-CHAN-15/16, migration 104)

Poc on the phone, both directions. Inbound: a caller rings the v2 DID, `/api/channels/inbound/voice`
verifies the Twilio signature, applies the caller gate + daily cap, and returns `<Connect><Stream>`
to the realtime bridge. Outbound: the owner (or `/call <number>` in chat) hits
`POST /api/app/apps/voice/calls`; Twilio dials, the callee answers, and
`/api/channels/voice/realtime-twiml` opens the same stream. The audio pipeline is OpenAI Realtime
(`gpt-realtime`, g711_ulaw both directions — Twilio frames relay verbatim, no transcoding).

### What shipped

- **Migration `104_voice_realtime_v2.sql`** — v2 columns on `pa_voice_calls` (`transcript_json`,
  `function_calls`, `engine`, `purpose`) + the append-only `pa_voice_call_events` ledger
  (speech / function_call / approval_request / approval_response / speak_queue).
- **ChannelAdapter** `src/lib/channels/adapters/voice/adapter.ts` — voice finally implements the
  contract (inbound = a signed ringing call, outbound = placing one) and is registered.
- **Realtime bridge libs** `src/lib/channels/voice/realtime/` — `session.ts` (the VoiceSocket ↔
  RealtimeSocket relay; approval gate is structural: the ONLY side-effect path a call has is
  `stageFunctionCall` → inbox card), `prompt.ts` (Poc's instructions from the character bio;
  banned-phrase list is a vitest gate), `cost.ts` (the two hard caps: **30 min wall-clock** and
  **$5.00 realized cost**, enforced on the session's own audio clock), `stage.ts` (send_email →
  one-tap-approvable draft; schedule_meeting / create_follow_up → decision cards), `bridge.ts`
  (prepare/finalize for the standalone service), `events-store.ts`, `views.ts`.
- **App** `/app/apps/voice` (+ `/[callId]` live transcript, staged-approval queue, speak-as-Poc,
  hang-up) — Studio+ / Enterprise, catalog slug `voice`, chat alias `/call <number>`.
- **Caps** — 30 min + $5 per call, **10 calls/owner/day** default (override:
  `pa_channel_connections.config.daily_call_cap`). Cost ledgers as `featureSlug='voice_call'`
  (Credits + Top Ups meter it at Studio+, PA-POS-30).
- **Cold-inbound posture** — unknown callers get Poc's polite decline unless
  `config.allow_unknown_callers=true` (default false; `config.allowed_callers[]` is the allow-list).
  Voice cold-onboarding deliberately waits for the WhatsApp funnel's moderation proof (§22.4).

### The standalone WS service, extended for v2

Same deployment as v0.1 (Fly/Render/Railway — anywhere a socket can live; `pnpm add ws` there).
For each Twilio Media Stream connection carrying `engine=realtime_v2`:

```ts
import WebSocket, { WebSocketServer } from "ws";
import { RealtimeBridgeSession, type RealtimeSocket } from "@/lib/channels/voice/realtime/session";
import {
  prepareRealtimeCall,
  finalizeRealtimeCall,
  realtimeAuthHeaders,
  REALTIME_WSS_URL,
} from "@/lib/channels/voice/realtime/bridge";
// 1. On WS upgrade, read ?callSid= and: const prepared = await prepareRealtimeCall(callSid);
//    (null → close; the TwiML routes only mint stream URLs for live v2 rows).
// 2. Dial OpenAI: new WebSocket(REALTIME_WSS_URL, { headers: realtimeAuthHeaders()! }) and adapt
//    it to RealtimeSocket; adapt the Twilio stream (start/media/stop frames) to VoiceSocket.
// 3. const session = new RealtimeBridgeSession(voiceSocket, realtimeSocket, prepared.deps);
//    session.start();
// 4. On stop: await finalizeRealtimeCall({ callSid, ownerId: prepared.ownerId, session });
```

### Chase — env vars for v2 (production + preview)

| Var | Value |
|---|---|
| `PA_VOICE_REALTIME_ENABLED` | leave UNSET until the bridge service is live; then `true` |
| `TWILIO_VOICE_PHONE_NUMBER` | the voice-enabled E.164 DID for v2 (inbound line + outbound caller ID) |
| `OPENAI_REALTIME_API_KEY` | optional — a dedicated key for realtime spend; falls back to `OPENAI_API_KEY` |
| `PA_VOICE_REALTIME_WSS_URL` | the bridge service origin, e.g. `wss://voice.aipocketagent.com/realtime`; falls back to `PA_VOICE_STREAM_WSS_URL` |

Twilio console for the v2 DID: Voice webhook → `https://aipocketagent.com/api/channels/inbound/voice`
(POST), status callback → `https://aipocketagent.com/api/channels/voice/status` (POST). The owner's
voice connection row must carry the DID as `external_id` (the inbound route resolves the owner by it).

### Migration

`supabase/migrations/104_voice_realtime_v2.sql` — additive, idempotent. Apply to `haizcnyywvewjygzeaaf`.
