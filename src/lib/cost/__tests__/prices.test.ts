// Unit tests for the cost price table (lib/cost/prices). Pins the realized-cost math for every backend
// PA fires — in MICRO-CENTS (1/10,000 of a cent; 1 USD = 1,000,000 micro-cents, PA-COST-9), the ledger's
// lossless storage unit — plus the unknown-model / unknown-backend degrade-to-0-with-a-warn contract so
// a missing rate surfaces in logs instead of silently mispricing the ledger.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getCostMicroCents } from "../prices";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCostMicroCents — anthropic", () => {
  it("prices claude-sonnet-4-6 at $3/1M input + $15/1M output (in micro-cents)", () => {
    // 1M input tokens = $3 = 3,000,000 micro-cents (3 micro-cents/token).
    expect(getCostMicroCents("anthropic", "claude-sonnet-4-6", { tokensInput: 1_000_000, tokensOutput: 0 })).toBeCloseTo(3_000_000, 3);
    // 1M output tokens = $15 = 15,000,000 micro-cents (15 micro-cents/token).
    expect(getCostMicroCents("anthropic", "claude-sonnet-4-6", { tokensInput: 0, tokensOutput: 1_000_000 })).toBeCloseTo(15_000_000, 3);
    // Combined.
    expect(getCostMicroCents("anthropic", "claude-sonnet-4-6", { tokensInput: 1_000_000, tokensOutput: 1_000_000 })).toBeCloseTo(18_000_000, 3);
  });

  it("returns exact integer micro-cents for a realistic single Sonnet call (1000 in + 200 out → 6000)", () => {
    // 1000 input * 3 + 200 output * 15 = 3000 + 3000 = 6000 micro-cents (= 0.6 cent). Lossless; the old
    // integer-cents path would have rounded 0.6 cent to 1 and lost the precise sub-cent split.
    expect(getCostMicroCents("anthropic", "claude-sonnet-4-6", { tokensInput: 1000, tokensOutput: 200 })).toBeCloseTo(6000, 6);
  });

  it("prices a dated haiku-4-5 model id via longest-prefix match ($0.80/1M in = 0.8 micro/token, $4/1M out)", () => {
    expect(getCostMicroCents("anthropic", "claude-haiku-4-5-20251001", { tokensInput: 1_000_000, tokensOutput: 0 })).toBeCloseTo(800_000, 3);
    expect(getCostMicroCents("anthropic", "claude-haiku-4-5-20251001", { tokensInput: 0, tokensOutput: 1_000_000 })).toBeCloseTo(4_000_000, 3);
  });

  it("returns exact integer micro-cents for a single Haiku classify (500 input → 400 micro-cents)", () => {
    // 500 input * 0.8 = 400 micro-cents (= 0.04 cent). Under the old INTEGER-cents column this single
    // classify rounded to ZERO — the precise bug 056 fixes.
    expect(getCostMicroCents("anthropic", "claude-haiku-4-5", { tokensInput: 500, tokensOutput: 0 })).toBeCloseTo(400, 6);
  });

  it("degrades an unknown Anthropic model to 0 micro-cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostMicroCents("anthropic", "claude-made-up-9", { tokensInput: 1_000_000, tokensOutput: 1_000_000 })).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("unknown Anthropic model");
  });

  it("degrades a null model to 0 micro-cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostMicroCents("anthropic", null, { tokensInput: 1_000_000 })).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getCostMicroCents — openai whisper", () => {
  it("prices whisper at $6 per audio-hour (in micro-cents)", () => {
    // 60 minutes = $6 = 6,000,000 micro-cents.
    expect(getCostMicroCents("openai", "whisper-1", { audioMinutes: 60 })).toBeCloseTo(6_000_000, 3);
    // 30 minutes = $3 = 3,000,000 micro-cents.
    expect(getCostMicroCents("openai", "whisper-1", { audioMinutes: 30 })).toBeCloseTo(3_000_000, 3);
    // A single 30-second voice memo (0.5 min) = ~50,000 micro-cents (= 0.5 cent) — survives losslessly
    // where the old integer column rounded a 0.5-cent clip down toward 0.
    expect(getCostMicroCents("openai", "whisper-1", { audioMinutes: 0.5 })).toBeCloseTo(50_000, 3);
    // No audio = 0.
    expect(getCostMicroCents("openai", "whisper-1", {})).toBe(0);
  });
});

describe("getCostMicroCents — bright_data", () => {
  it("prices Web Unlocker / SERP at ~$3 per 1k requests (in micro-cents)", () => {
    // 1000 requests = $3 = 3,000,000 micro-cents.
    expect(getCostMicroCents("bright_data", null, { requests: 1000 })).toBeCloseTo(3_000_000, 3);
    // One request = 0.3 cent = 3,000 micro-cents — under the old INTEGER-cents column it rounded to ZERO.
    expect(getCostMicroCents("bright_data", null, { requests: 1 })).toBeCloseTo(3000, 6);
  });
});

describe("getCostMicroCents — modal", () => {
  it("prices active CPU seconds + provisioned memory GB-hours (in micro-cents)", () => {
    // 1000 CPU-seconds * $0.000131 = $0.131 = 13.1 cents = 131,000 micro-cents.
    expect(getCostMicroCents("modal", null, { cpuSeconds: 1000 })).toBeCloseTo(131_000, 3);
    // 1 GB-hour memory * $0.024 = 2.4 cents = 24,000 micro-cents.
    expect(getCostMicroCents("modal", null, { memoryGbHours: 1 })).toBeCloseTo(24_000, 3);
    // Combined.
    expect(getCostMicroCents("modal", null, { cpuSeconds: 1000, memoryGbHours: 1 })).toBeCloseTo(155_000, 3);
  });
});

describe("getCostMicroCents — backend without a price model", () => {
  it("degrades twilio/resend to 0 micro-cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostMicroCents("twilio", null, {})).toBe(0);
    expect(getCostMicroCents("resend", null, {})).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain("no price model for backend");
  });
});
