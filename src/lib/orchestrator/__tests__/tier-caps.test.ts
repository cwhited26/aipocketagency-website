import { describe, it, expect } from "vitest";
import {
  AGENT_MINUTE_CAPS,
  MAX_SUBAGENTS_PER_TASK,
  AUTO_APPROVE_TRUST_WINDOW,
  agentMinuteCap,
  maxSubAgents,
  monthKey,
  evaluateAgentMinutes,
  evaluateSubAgentFanout,
  autoApproveUnlocked,
} from "../tier-caps";

describe("AGENT_MINUTE_CAPS", () => {
  it("encodes the SPEC §10 agent-minute ladder", () => {
    expect(AGENT_MINUTE_CAPS.starter).toBe(0);
    expect(AGENT_MINUTE_CAPS.pro).toBe(100);
    expect(AGENT_MINUTE_CAPS.pro_plus).toBe(250);
    expect(AGENT_MINUTE_CAPS.studio).toBe(1000);
    expect(AGENT_MINUTE_CAPS.studio_plus).toBe(3000);
    expect(AGENT_MINUTE_CAPS.enterprise).toBeNull();
  });

  it("encodes the sub-agents-per-task ladder", () => {
    expect(MAX_SUBAGENTS_PER_TASK.starter).toBe(0);
    expect(MAX_SUBAGENTS_PER_TASK.pro).toBe(3);
    expect(MAX_SUBAGENTS_PER_TASK.pro_plus).toBe(5);
    expect(MAX_SUBAGENTS_PER_TASK.studio).toBe(10);
    expect(MAX_SUBAGENTS_PER_TASK.studio_plus).toBe(25);
    expect(MAX_SUBAGENTS_PER_TASK.enterprise).toBeNull();
  });

  it("exposes caps via the helpers", () => {
    expect(agentMinuteCap("pro")).toBe(100);
    expect(agentMinuteCap("enterprise")).toBeNull();
    expect(maxSubAgents("studio")).toBe(10);
  });
});

describe("monthKey", () => {
  it("formats yyyy-mm in UTC", () => {
    expect(monthKey(new Date("2026-06-06T12:00:00Z"))).toBe("2026-06");
    expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });
});

describe("evaluateAgentMinutes", () => {
  it("blocks Starter (cap 0) with the upsell CTA", () => {
    const d = evaluateAgentMinutes("starter", 0, 5);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/Pro/);
  });

  it("never blocks Enterprise (unlimited)", () => {
    expect(evaluateAgentMinutes("enterprise", 999_999, 10_000).ok).toBe(true);
  });

  it("allows a run that fits under the cap", () => {
    expect(evaluateAgentMinutes("pro", 0, 50).ok).toBe(true);
    expect(evaluateAgentMinutes("pro", 80, 20).ok).toBe(true); // exactly at the cap
  });

  it("blocks once used is at/over the cap", () => {
    expect(evaluateAgentMinutes("pro", 100, 1).ok).toBe(false);
    expect(evaluateAgentMinutes("pro", 120, 1).ok).toBe(false);
  });

  it("blocks a run that would overshoot the cap", () => {
    const d = evaluateAgentMinutes("pro", 80, 30); // 110 > 100
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/agent-minutes/);
  });
});

describe("evaluateSubAgentFanout", () => {
  it("blocks Starter entirely", () => {
    expect(evaluateSubAgentFanout("starter", 1).ok).toBe(false);
  });
  it("allows fan-out up to the tier limit and blocks beyond", () => {
    expect(evaluateSubAgentFanout("pro", 3).ok).toBe(true);
    expect(evaluateSubAgentFanout("pro", 4).ok).toBe(false);
    expect(evaluateSubAgentFanout("studio", 10).ok).toBe(true);
    expect(evaluateSubAgentFanout("studio", 11).ok).toBe(false);
  });
  it("never blocks Enterprise", () => {
    expect(evaluateSubAgentFanout("enterprise", 500).ok).toBe(true);
  });
});

describe("autoApproveUnlocked", () => {
  it("unlocks only at/after the trust window", () => {
    expect(AUTO_APPROVE_TRUST_WINDOW).toBe(10);
    expect(autoApproveUnlocked(0)).toBe(false);
    expect(autoApproveUnlocked(9)).toBe(false);
    expect(autoApproveUnlocked(10)).toBe(true);
    expect(autoApproveUnlocked(25)).toBe(true);
  });
});
