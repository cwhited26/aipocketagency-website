// Unit tests for the cost price table (lib/cost/prices). Pins the realized-cost math for every backend
// PA fires + the unknown-model / unknown-backend degrade-to-0-cents-with-a-warn contract so a missing
// rate surfaces in logs instead of silently mispricing the ledger.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getCostCents } from "../prices";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCostCents — anthropic", () => {
  it("prices claude-sonnet-4-6 at $3/1M input + $15/1M output", () => {
    // 1M input tokens = $3 = 300 cents.
    expect(getCostCents("anthropic", "claude-sonnet-4-6", { tokensInput: 1_000_000, tokensOutput: 0 })).toBeCloseTo(300, 6);
    // 1M output tokens = $15 = 1500 cents.
    expect(getCostCents("anthropic", "claude-sonnet-4-6", { tokensInput: 0, tokensOutput: 1_000_000 })).toBeCloseTo(1500, 6);
    // Combined.
    expect(getCostCents("anthropic", "claude-sonnet-4-6", { tokensInput: 1_000_000, tokensOutput: 1_000_000 })).toBeCloseTo(1800, 6);
  });

  it("prices a dated haiku-4-5 model id via longest-prefix match ($0.80/1M in, $4/1M out)", () => {
    expect(getCostCents("anthropic", "claude-haiku-4-5-20251001", { tokensInput: 1_000_000, tokensOutput: 0 })).toBeCloseTo(80, 6);
    expect(getCostCents("anthropic", "claude-haiku-4-5-20251001", { tokensInput: 0, tokensOutput: 1_000_000 })).toBeCloseTo(400, 6);
  });

  it("degrades an unknown Anthropic model to 0 cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostCents("anthropic", "claude-made-up-9", { tokensInput: 1_000_000, tokensOutput: 1_000_000 })).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("unknown Anthropic model");
  });

  it("degrades a null model to 0 cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostCents("anthropic", null, { tokensInput: 1_000_000 })).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getCostCents — openai whisper", () => {
  it("prices whisper at $6 per audio-hour", () => {
    // 60 minutes = $6 = 600 cents.
    expect(getCostCents("openai", "whisper-1", { audioMinutes: 60 })).toBeCloseTo(600, 6);
    // 30 minutes = $3 = 300 cents.
    expect(getCostCents("openai", "whisper-1", { audioMinutes: 30 })).toBeCloseTo(300, 6);
    // No audio = 0.
    expect(getCostCents("openai", "whisper-1", {})).toBe(0);
  });
});

describe("getCostCents — bright_data", () => {
  it("prices Web Unlocker / SERP at ~$3 per 1k requests", () => {
    // 1000 requests = $3 = 300 cents.
    expect(getCostCents("bright_data", null, { requests: 1000 })).toBeCloseTo(300, 6);
    // One request = 0.3 cents.
    expect(getCostCents("bright_data", null, { requests: 1 })).toBeCloseTo(0.3, 6);
  });
});

describe("getCostCents — modal", () => {
  it("prices active CPU seconds + provisioned memory GB-hours", () => {
    // 1000 CPU-seconds * $0.000131 = $0.131 = 13.1 cents.
    expect(getCostCents("modal", null, { cpuSeconds: 1000 })).toBeCloseTo(13.1, 6);
    // 1 GB-hour memory * $0.024 = 2.4 cents.
    expect(getCostCents("modal", null, { memoryGbHours: 1 })).toBeCloseTo(2.4, 6);
    // Combined.
    expect(getCostCents("modal", null, { cpuSeconds: 1000, memoryGbHours: 1 })).toBeCloseTo(15.5, 6);
  });
});

describe("getCostCents — backend without a price model", () => {
  it("degrades twilio/resend to 0 cents and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCostCents("twilio", null, {})).toBe(0);
    expect(getCostCents("resend", null, {})).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain("no price model for backend");
  });
});
