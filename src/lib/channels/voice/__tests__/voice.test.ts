import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

import {
  muLawEncodeSample,
  muLawDecodeSample,
  muLawToPcm16,
  pcm16ToMuLaw,
  pcm16Rms,
  stepSilence,
  initialSilenceState,
} from "../audio";
import { computeTwilioSignature, verifyTwilioSignature } from "../twilio";
import {
  parseVoiceProfile,
  serializeVoiceProfile,
  buildVoiceSystemPreamble,
  isWriteIntent,
  isConfirmSendPhrase,
  DEFAULT_VOICE_PROFILE,
} from "../profile";
import { computeVoiceCallCeilingSeconds } from "@/lib/tiers/voice";
import { downsamplePcm16, frameMuLawForTwilio } from "../tts";
import { wrapPcm16AsWav, VoiceTranscriber } from "../stt";
import { computeCallCostBreakdown } from "../cost";
import { handleVoiceTurn, initialVoiceTurnState } from "../dispatcher-voice";

// ── µ-law ↔ PCM transcode ───────────────────────────────────────────────────────────────────
describe("g.711 µ-law codec", () => {
  it("encodes to a byte and decodes to int16", () => {
    for (const s of [0, 100, -100, 1000, -1000, 8000, -8000, 32767, -32768]) {
      const b = muLawEncodeSample(s);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
      const d = muLawDecodeSample(b);
      expect(d).toBeGreaterThanOrEqual(-32768);
      expect(d).toBeLessThanOrEqual(32767);
    }
  });

  it("round-trips within the µ-law quantization bound", () => {
    for (const s of [0, 250, -250, 1500, -1500, 5000, -5000, 20000, -20000]) {
      const back = muLawDecodeSample(muLawEncodeSample(s));
      // µ-law is 8-bit lossy; error grows with magnitude. Allow max(256, 12% of |s|).
      const tolerance = Math.max(256, Math.abs(s) * 0.12);
      expect(Math.abs(back - s)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("preserves sign", () => {
    expect(muLawDecodeSample(muLawEncodeSample(4000))).toBeGreaterThan(0);
    expect(muLawDecodeSample(muLawEncodeSample(-4000))).toBeLessThan(0);
  });

  it("buffer transcode preserves sample count", () => {
    const pcm = Buffer.alloc(320); // 160 int16 samples
    for (let i = 0; i < 160; i++) pcm.writeInt16LE(((i % 50) - 25) * 200, i * 2);
    const mulaw = pcm16ToMuLaw(pcm);
    expect(mulaw.length).toBe(160);
    const roundTrip = muLawToPcm16(mulaw);
    expect(roundTrip.length).toBe(320);
  });
});

// ── Silence detector ────────────────────────────────────────────────────────────────────────
describe("silence detector", () => {
  const cfg = { rmsThreshold: 500, silenceMs: 800 };

  it("does not complete a turn on leading silence before any speech", () => {
    let state = initialSilenceState();
    for (let i = 0; i < 100; i++) {
      const out = stepSilence(state, 0, 20, cfg);
      state = out.state;
      expect(out.turnComplete).toBe(false);
    }
  });

  it("completes a turn after speech then >800ms silence", () => {
    let state = initialSilenceState();
    // 200ms of speech
    for (let i = 0; i < 10; i++) state = stepSilence(state, 4000, 20, cfg).state;
    expect(state.hasSpeech).toBe(true);
    // 800ms of silence: 39 frames not yet, 40th crosses
    let completed = false;
    for (let i = 0; i < 40; i++) {
      const out = stepSilence(state, 0, 20, cfg);
      state = out.state;
      if (out.turnComplete) completed = true;
    }
    expect(completed).toBe(true);
  });

  it("resets trailing silence when speech resumes", () => {
    let state = initialSilenceState();
    state = stepSilence(state, 4000, 20, cfg).state;
    state = stepSilence(state, 0, 400, cfg).state;
    expect(state.trailingSilenceMs).toBe(400);
    state = stepSilence(state, 4000, 20, cfg).state;
    expect(state.trailingSilenceMs).toBe(0);
  });

  it("pcm16Rms is 0 for silence, positive for a tone", () => {
    expect(pcm16Rms(Buffer.alloc(320))).toBe(0);
    const tone = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) tone.writeInt16LE(5000, i * 2);
    expect(pcm16Rms(tone)).toBeGreaterThan(4000);
  });
});

// ── Twilio signature verify ─────────────────────────────────────────────────────────────────
describe("twilio signature", () => {
  const token = "test_auth_token";
  const url = "https://aipocketagent.com/api/channels/voice/twiml?owner=abc";
  const params = { CallSid: "CA123", From: "+14155550100", To: "+14155550199" };

  it("computes the documented HMAC-SHA1 base64 signature", () => {
    const sorted = Object.keys(params).sort();
    let data = url;
    for (const k of sorted) data += k + (params as Record<string, string>)[k];
    const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");
    expect(computeTwilioSignature(token, url, params)).toBe(expected);
  });

  it("verifies a valid signature and rejects a forged / missing one", () => {
    const sig = computeTwilioSignature(token, url, params);
    expect(verifyTwilioSignature({ authToken: token, url, params, signature: sig })).toBe(true);
    expect(verifyTwilioSignature({ authToken: token, url, params, signature: "bogus" })).toBe(false);
    expect(verifyTwilioSignature({ authToken: token, url, params, signature: null })).toBe(false);
    expect(
      verifyTwilioSignature({ authToken: "wrong", url, params, signature: sig }),
    ).toBe(false);
  });

  it("is order-independent over params", () => {
    const a = computeTwilioSignature(token, url, { b: "2", a: "1" });
    const b = computeTwilioSignature(token, url, { a: "1", b: "2" });
    expect(a).toBe(b);
  });
});

// ── Tier caps ───────────────────────────────────────────────────────────────────────────────
describe("voice tier caps", () => {
  it("ceilings the call by remaining monthly minutes", () => {
    const c = computeVoiceCallCeilingSeconds({
      tier: "pro", // 60 min/mo
      usedThisMonthMinutes: 58,
      usedTodayMinutes: 0,
      perCallMaxSeconds: 600,
    });
    expect(c.allowedSeconds).toBe(120); // 2 min remaining
    expect(c.limitedBy).toBe("monthly");
  });

  it("refuses (0s) when the monthly cap is exhausted", () => {
    const c = computeVoiceCallCeilingSeconds({
      tier: "starter", // 10 min/mo
      usedThisMonthMinutes: 10,
      usedTodayMinutes: 0,
      perCallMaxSeconds: 600,
    });
    expect(c.allowedSeconds).toBe(0);
  });

  it("applies the daily cap on unlimited tiers", () => {
    const c = computeVoiceCallCeilingSeconds({
      tier: "studio_plus", // unlimited monthly, 60 min/day
      usedThisMonthMinutes: 100000,
      usedTodayMinutes: 59,
      perCallMaxSeconds: 3600,
    });
    expect(c.allowedSeconds).toBe(60); // 1 min left today
    expect(c.limitedBy).toBe("daily");
  });

  it("falls back to the shared-pool per-call cap (180s) when no own-number max", () => {
    const c = computeVoiceCallCeilingSeconds({
      tier: "pro",
      usedThisMonthMinutes: 0,
      usedTodayMinutes: 0,
      perCallMaxSeconds: null,
    });
    expect(c.allowedSeconds).toBe(180);
    expect(c.limitedBy).toBe("per_call");
  });
});

// ── "confirm send" matcher + write-intent ─────────────────────────────────────────────────────
describe("voice safety matchers", () => {
  it("matches the confirm-send phrase tolerant of case/filler", () => {
    expect(isConfirmSendPhrase("confirm send")).toBe(true);
    expect(isConfirmSendPhrase("Okay, confirm send.")).toBe(true);
    expect(isConfirmSendPhrase("CONFIRM   SEND")).toBe(true);
    expect(isConfirmSendPhrase("please send it")).toBe(false);
    expect(isConfirmSendPhrase("confirm the meeting")).toBe(false);
  });

  it("detects write intent but not read intent", () => {
    expect(isWriteIntent("send an email to Alan")).toBe(true);
    expect(isWriteIntent("schedule a meeting tomorrow")).toBe(true);
    expect(isWriteIntent("transfer $200 to savings")).toBe(true);
    expect(isWriteIntent("what's on my calendar today")).toBe(false);
    expect(isWriteIntent("summarize my last email from Alan")).toBe(false);
  });
});

// ── Voice profile loader ──────────────────────────────────────────────────────────────────────
describe("voice profile", () => {
  it("defaults an empty / null / non-object profile", () => {
    expect(parseVoiceProfile(null)).toEqual(DEFAULT_VOICE_PROFILE);
    expect(parseVoiceProfile({})).toEqual(DEFAULT_VOICE_PROFILE);
    expect(parseVoiceProfile("nope")).toEqual(DEFAULT_VOICE_PROFILE);
  });

  it("parses a full profile and ignores bad field types", () => {
    const p = parseVoiceProfile({
      elevenlabs_voice_id: "voice-123",
      speaking_style: "playful",
      addressing: "call me boss",
      max_persona_quips_per_call: 3,
      greeting: "Yo.",
      farewell: "Later.",
      fallback_voice_id: "fallback-9",
    });
    expect(p.elevenlabsVoiceId).toBe("voice-123");
    expect(p.speakingStyle).toBe("playful");
    expect(p.maxPersonaQuipsPerCall).toBe(3);
    expect(p.fallbackVoiceId).toBe("fallback-9");

    const bad = parseVoiceProfile({ max_persona_quips_per_call: -5, speaking_style: 42 });
    expect(bad.maxPersonaQuipsPerCall).toBe(DEFAULT_VOICE_PROFILE.maxPersonaQuipsPerCall);
    expect(bad.speakingStyle).toBe(DEFAULT_VOICE_PROFILE.speakingStyle);
  });

  it("round-trips through serialize/parse", () => {
    const p = parseVoiceProfile({ elevenlabs_voice_id: "v", greeting: "Hi there." });
    expect(parseVoiceProfile(serializeVoiceProfile(p))).toEqual(p);
  });

  it("preamble injects style, addressing, quip cap, and the read-only posture", () => {
    const preamble = buildVoiceSystemPreamble(parseVoiceProfile({ speaking_style: "dry wit", max_persona_quips_per_call: 2 }));
    expect(preamble).toContain("dry wit");
    expect(preamble).toContain("at most 2 short personality quips");
    expect(preamble).toContain("READ-ONLY");
    const noQuip = buildVoiceSystemPreamble(parseVoiceProfile({ max_persona_quips_per_call: 0 }));
    expect(noQuip).toContain("Do not add personality quips");
  });
});

// ── TTS framing ────────────────────────────────────────────────────────────────────────────
describe("tts framing", () => {
  it("downsamples 16k→8k by averaging pairs", () => {
    const pcm = Buffer.alloc(8); // 4 samples
    pcm.writeInt16LE(100, 0);
    pcm.writeInt16LE(200, 2);
    pcm.writeInt16LE(300, 4);
    pcm.writeInt16LE(500, 6);
    const out = downsamplePcm16(pcm, 16000, 8000);
    expect(out.length).toBe(4); // 2 samples
    expect(out.readInt16LE(0)).toBe(150);
    expect(out.readInt16LE(2)).toBe(400);
  });

  it("rejects a non-integer downsample factor", () => {
    expect(() => downsamplePcm16(Buffer.alloc(4), 16000, 7000)).toThrow();
  });

  it("frames µ-law into 160-byte base64 chunks", () => {
    const frames = frameMuLawForTwilio(Buffer.alloc(400));
    expect(frames.length).toBe(3); // 160 + 160 + 80
    expect(Buffer.from(frames[0], "base64").length).toBe(160);
    expect(Buffer.from(frames[2], "base64").length).toBe(80);
  });
});

// ── WAV wrapper + transcriber ────────────────────────────────────────────────────────────────
describe("stt", () => {
  it("wraps PCM in a 44-byte WAV header with correct fields", () => {
    const pcm = Buffer.alloc(160);
    const wav = wrapPcm16AsWav(pcm, 8000);
    expect(wav.length).toBe(44 + 160);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(8000); // sample rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it("finalizes a turn on silence and transcribes once", async () => {
    let calls = 0;
    const t = new VoiceTranscriber({
      transcribe: async () => {
        calls += 1;
        return "hello there";
      },
      silenceConfig: { rmsThreshold: 500, silenceMs: 100 },
    });
    const speech = Buffer.alloc(160);
    for (let i = 0; i < 160; i++) speech[i] = muLawEncodeSample(6000);
    const silence = Buffer.alloc(160);
    for (let i = 0; i < 160; i++) silence[i] = muLawEncodeSample(0);

    // 3 speech frames (60ms), then silence frames until the 100ms threshold trips.
    expect(t.addFrame(speech, 20)).toBe(false);
    t.addFrame(speech, 20);
    t.addFrame(speech, 20);
    let ready = false;
    for (let i = 0; i < 10 && !ready; i++) ready = t.addFrame(silence, 20);
    expect(ready).toBe(true);
    const turn = await t.takeTurn();
    expect(turn.text).toBe("hello there");
    expect(calls).toBe(1);
    expect(turn.audioSeconds).toBeGreaterThan(0);
  });
});

// ── Cost breakdown ────────────────────────────────────────────────────────────────────────
describe("cost breakdown", () => {
  it("prices each segment and sums the total", () => {
    const b = computeCallCostBreakdown({ callSeconds: 60, whisperAudioSeconds: 30, ttsAudioSeconds: 30 });
    expect(b.twilio_cents).toBeCloseTo(1.3, 5); // $0.013/min * 1 min = 1.3 cents
    expect(b.whisper_cents).toBeCloseTo(0.3, 5); // $0.006/min * 0.5 min = 0.3 cents
    expect(b.elevenlabs_cents).toBeCloseTo(9, 5); // $0.18/min * 0.5 min = 9 cents
    expect(b.llm_cents).toBeCloseTo(4, 5); // $0.04/min * 1 min = 4 cents
    expect(b.total_cents).toBeCloseTo(1.3 + 0.3 + 9 + 4, 5);
  });
});

// ── Dispatcher voice turn policy ──────────────────────────────────────────────────────────────
describe("voice turn policy", () => {
  const baseDeps = {
    answer: async () => "Here's what I found.",
    stageWrite: async () => undefined,
  };

  it("answers a read-only turn inline", async () => {
    const r = await handleVoiceTurn("what's on my calendar", initialVoiceTurnState(), baseDeps);
    expect(r.staged).toBe(false);
    expect(r.executed).toBe(false);
    expect(r.spokenText).toBe("Here's what I found.");
  });

  it("stages a write turn and speaks the staged line", async () => {
    let staged = 0;
    const r = await handleVoiceTurn(
      "send an email to Alan",
      initialVoiceTurnState(),
      { ...baseDeps, stageWrite: async () => { staged += 1; } },
    );
    expect(staged).toBe(1);
    expect(r.staged).toBe(true);
    expect(r.spokenText).toContain("staged");
  });

  it("executes a write once confirm-send has unlocked the call", async () => {
    let executed = 0;
    const deps = {
      ...baseDeps,
      execute: async () => {
        executed += 1;
        return "Sent.";
      },
    };
    const unlocked = await handleVoiceTurn("confirm send", initialVoiceTurnState(), deps);
    expect(unlocked.state.confirmUnlocked).toBe(true);
    const r = await handleVoiceTurn("send an email to Alan", unlocked.state, deps);
    expect(executed).toBe(1);
    expect(r.executed).toBe(true);
    expect(r.spokenText).toBe("Sent.");
  });

  it("no-ops an empty transcript", async () => {
    const r = await handleVoiceTurn("   ", initialVoiceTurnState(), baseDeps);
    expect(r.spokenText).toBe("");
  });
});
