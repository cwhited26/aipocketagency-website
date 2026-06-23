// Unit tests for the pure Deepgram client helpers (MP-CORE-2): listen-URL building + live-result
// parsing/normalization. No network.

import { describe, expect, it } from "vitest";
import { buildListenUrl, parseDeepgramResult } from "../client";
import { LiveTranscriptionOptionsSchema } from "../types";

describe("buildListenUrl", () => {
  it("encodes the MP-CORE-2 defaults", () => {
    const url = buildListenUrl(LiveTranscriptionOptionsSchema.parse({}));
    expect(url).toContain("model=nova-2");
    expect(url).toContain("language=en-US");
    expect(url).toContain("smart_format=true");
    expect(url).toContain("interim_results=true");
    expect(url).toContain("diarize=true");
    expect(url).toContain("endpointing=300");
  });

  it("adds encoding + sample_rate only when given", () => {
    const base = buildListenUrl(LiveTranscriptionOptionsSchema.parse({}));
    expect(base).not.toContain("encoding=");
    const withRaw = buildListenUrl(
      LiveTranscriptionOptionsSchema.parse({ encoding: "linear16", sampleRate: 16000 }),
    );
    expect(withRaw).toContain("encoding=linear16");
    expect(withRaw).toContain("sample_rate=16000");
  });
});

describe("parseDeepgramResult", () => {
  it("normalizes a Results message with diarization", () => {
    const chunk = parseDeepgramResult({
      type: "Results",
      start: 1.5,
      duration: 2.0,
      is_final: true,
      channel: {
        alternatives: [
          { transcript: "hello there", confidence: 0.98, words: [{ word: "hello", speaker: 2 }] },
        ],
      },
    });
    expect(chunk).toEqual({
      text: "hello there",
      confidence: 0.98,
      isFinal: true,
      startMs: 1500,
      endMs: 3500,
      speakerLabel: "speaker_2",
    });
  });

  it("returns null for an empty transcript (silence/interim noise)", () => {
    expect(
      parseDeepgramResult({ type: "Results", channel: { alternatives: [{ transcript: "" }] } }),
    ).toBeNull();
  });

  it("returns null for non-Results messages", () => {
    expect(parseDeepgramResult({ type: "Metadata", duration: 12.3 })).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(parseDeepgramResult("nope")).toBeNull();
    expect(parseDeepgramResult(null)).toBeNull();
  });
});
