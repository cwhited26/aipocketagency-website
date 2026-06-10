import { describe, it, expect } from "vitest";
import {
  usageCap,
  usagePct,
  evaluateTierLimitGate,
  nextTierUp,
  metricConfig,
  USAGE_WARN_PCT,
  USAGE_GATE_PCT,
} from "../caps";

describe("usageCap", () => {
  it("returns the locked Lead Scout numbers per tier", () => {
    expect(usageCap("lead_scout", "starter")).toBe(25);
    expect(usageCap("lead_scout", "pro")).toBe(250);
    expect(usageCap("lead_scout", "pro_plus")).toBe(500);
    expect(usageCap("lead_scout", "studio")).toBe(2_500);
    expect(usageCap("lead_scout", "studio_plus")).toBe(10_000);
    expect(usageCap("lead_scout", "enterprise")).toBeNull();
  });

  it("stores podcast caps in minutes (30 min free, 5h pro, 50h studio, 500h studio+)", () => {
    expect(usageCap("podcast_whisper", "starter")).toBe(30);
    expect(usageCap("podcast_whisper", "pro")).toBe(300);
    expect(usageCap("podcast_whisper", "studio")).toBe(3_000);
    expect(usageCap("podcast_whisper", "studio_plus")).toBe(30_000);
  });

  it("reuses the Decision Roundtable monthly caps (Studio+ 30, Enterprise 150)", () => {
    expect(usageCap("roundtable", "studio")).toBe(0);
    expect(usageCap("roundtable", "studio_plus")).toBe(30);
    expect(usageCap("roundtable", "enterprise")).toBe(150);
  });

  it("treats informational metrics (YouTube, Connections) as uncapped (null)", () => {
    expect(usageCap("youtube", "studio")).toBeNull();
    expect(usageCap("connections", "studio")).toBeNull();
    expect(metricConfig("youtube").caps).toBeUndefined();
    expect(metricConfig("connections").note).toBeTruthy();
  });
});

describe("usagePct", () => {
  it("is a straight ratio against a positive cap", () => {
    expect(usagePct(132, 2_500)).toBeCloseTo(5.28, 2);
    expect(usagePct(200, 250)).toBe(80);
    expect(usagePct(250, 250)).toBe(100);
  });

  it("never fills an unlimited or feature-off metric", () => {
    expect(usagePct(999, null)).toBe(0);
    expect(usagePct(999, 0)).toBe(0);
  });
});

describe("evaluateTierLimitGate", () => {
  it("passes below the warn threshold", () => {
    expect(evaluateTierLimitGate(100, 250, null).status).toBe("ok");
  });

  it(`warns from ${USAGE_WARN_PCT}% to <${USAGE_GATE_PCT}% when un-acked`, () => {
    expect(evaluateTierLimitGate(200, 250, null).status).toBe("warn_80");
    expect(evaluateTierLimitGate(249, 250, null).status).toBe("warn_80");
  });

  it("a keep_going ack silences the warn for the period", () => {
    expect(evaluateTierLimitGate(200, 250, "keep_going").status).toBe("ok");
  });

  it("blocks at 100%+, regardless of ack", () => {
    expect(evaluateTierLimitGate(250, 250, null).status).toBe("block_100");
    expect(evaluateTierLimitGate(300, 250, "keep_going").status).toBe("block_100");
  });

  it("a pause ack blocks even below the warn threshold", () => {
    expect(evaluateTierLimitGate(1, 250, "pause").status).toBe("block_100");
  });

  it("unlimited or feature-off caps always pass (the hard cap handles those elsewhere)", () => {
    expect(evaluateTierLimitGate(9_999, null, null).status).toBe("ok");
    expect(evaluateTierLimitGate(9_999, 0, null).status).toBe("ok");
  });
});

describe("nextTierUp", () => {
  it("walks the ladder and stops at enterprise", () => {
    expect(nextTierUp("starter")).toBe("pro");
    expect(nextTierUp("studio")).toBe("studio_plus");
    expect(nextTierUp("studio_plus")).toBe("enterprise");
    expect(nextTierUp("enterprise")).toBeNull();
  });
});
