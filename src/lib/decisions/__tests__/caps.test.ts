import { describe, it, expect } from "vitest";
import {
  tierAllowsDecisionRoundtable,
  decisionRoundtableMonthlyCap,
  evaluateCanRunRoundtable,
  DECISION_ROUNDTABLE_MONTHLY_CAPS,
} from "../../personas/tier-caps";

describe("Decision Roundtable tier gating (PA-DR-1)", () => {
  it("allows only Studio+ and Enterprise", () => {
    expect(tierAllowsDecisionRoundtable("studio_plus")).toBe(true);
    expect(tierAllowsDecisionRoundtable("enterprise")).toBe(true);
    expect(tierAllowsDecisionRoundtable("studio")).toBe(false);
    expect(tierAllowsDecisionRoundtable("pro")).toBe(false);
    expect(tierAllowsDecisionRoundtable("starter")).toBe(false);
  });

  it("encodes the §11 monthly caps", () => {
    expect(decisionRoundtableMonthlyCap("studio_plus")).toBe(30);
    expect(decisionRoundtableMonthlyCap("enterprise")).toBe(150);
    expect(decisionRoundtableMonthlyCap("studio")).toBe(0);
    expect(DECISION_ROUNDTABLE_MONTHLY_CAPS.starter).toBe(0);
  });
});

describe("evaluateCanRunRoundtable", () => {
  it("refuses a gated tier with an upgrade reason", () => {
    const r = evaluateCanRunRoundtable("pro", 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Studio+");
  });

  it("allows an eligible tier under its cap", () => {
    expect(evaluateCanRunRoundtable("studio_plus", 0).ok).toBe(true);
    expect(evaluateCanRunRoundtable("studio_plus", 29).ok).toBe(true);
  });

  it("refuses once the monthly cap is reached", () => {
    const r = evaluateCanRunRoundtable("studio_plus", 30);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("30");
  });

  it("gives Enterprise its larger ceiling", () => {
    expect(evaluateCanRunRoundtable("enterprise", 149).ok).toBe(true);
    expect(evaluateCanRunRoundtable("enterprise", 150).ok).toBe(false);
  });
});
