import { describe, it, expect } from "vitest";
import {
  BROWSERBASE_MICRO_CENTS_PER_SECOND,
  SONNET_INPUT_MICRO_CENTS_PER_TOKEN,
  SONNET_OUTPUT_MICRO_CENTS_PER_TOKEN,
  evaluateCostCap,
  formatMicroCentsUsd,
  stepCostMicroCents,
} from "../cost";

describe("stepCostMicroCents", () => {
  it("prices tokens at the Sonnet 4.6 sticker plus browser seconds", () => {
    const cost = stepCostMicroCents({ tokensInput: 2_000, tokensOutput: 300, browserSeconds: 10 });
    expect(cost).toBe(
      2_000 * SONNET_INPUT_MICRO_CENTS_PER_TOKEN +
        300 * SONNET_OUTPUT_MICRO_CENTS_PER_TOKEN +
        10 * BROWSERBASE_MICRO_CENTS_PER_SECOND,
    );
  });

  it("never goes negative on garbage inputs", () => {
    expect(stepCostMicroCents({ tokensInput: -5, tokensOutput: -5, browserSeconds: -5 })).toBe(0);
  });
});

describe("evaluateCostCap — the runaway-job halt (SPEC test b)", () => {
  it("passes under the cap", () => {
    expect(evaluateCostCap({ spentMicroCents: 4_999_999, maxCostMicroCents: 5_000_000 }).ok).toBe(true);
  });

  it("halts at the cap exactly (never one more planning call past it)", () => {
    const d = evaluateCostCap({ spentMicroCents: 5_000_000, maxCostMicroCents: 5_000_000 });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toContain("$5.00");
  });

  it("halts past the cap", () => {
    expect(evaluateCostCap({ spentMicroCents: 6_000_000, maxCostMicroCents: 5_000_000 }).ok).toBe(false);
  });
});

describe("formatMicroCentsUsd", () => {
  it("renders micro-cents as dollars", () => {
    expect(formatMicroCentsUsd(5_000_000)).toBe("$5.00");
    expect(formatMicroCentsUsd(123_456)).toBe("$0.12");
    expect(formatMicroCentsUsd(0)).toBe("$0.00");
  });
});
