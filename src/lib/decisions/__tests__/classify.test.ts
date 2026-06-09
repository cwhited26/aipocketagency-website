import { describe, it, expect } from "vitest";
import { scoreDecisionHeuristics } from "../classify";

describe("scoreDecisionHeuristics", () => {
  it("fires on a clear decision question and tags the type", () => {
    const r = scoreDecisionHeuristics("Should I raise prices on Patrick?");
    expect(r.hit).toBe(true);
    expect(r.score).toBeGreaterThan(0.3);
    expect(r.decisionType).toBe("pricing");
  });

  it("ignores a routine task with no decision marker", () => {
    expect(scoreDecisionHeuristics("What's my next meeting?").hit).toBe(false);
    expect(scoreDecisionHeuristics("Draft a recap email to Dana").hit).toBe(false);
    expect(scoreDecisionHeuristics("Summarize the discovery call").score).toBe(0);
  });

  it("pulls a routine-shaped ask with a grazing marker back down", () => {
    // "should I just send the recap email" grazes 'should i' but is a routine send.
    const r = scoreDecisionHeuristics("Should I just send the recap email now?");
    expect(r.score).toBeLessThan(0.5);
  });

  it("amplifies on money + time pressure and raises stakes", () => {
    const plain = scoreDecisionHeuristics("Should I hire another rep?");
    const loaded = scoreDecisionHeuristics("Should I hire another rep for $80k by Friday?");
    expect(loaded.score).toBeGreaterThan(plain.score);
    expect(loaded.stakesLevel).toBe("high");
    expect(loaded.decisionType).toBe("hiring");
  });

  it("detects firing + scope shapes", () => {
    expect(scoreDecisionHeuristics("Should I fire this client?").decisionType).toBe("firing");
    expect(scoreDecisionHeuristics("Is it worth taking on commercial roofing as a new service?").decisionType).toBe(
      "scope",
    );
  });

  it("returns empty on blank input", () => {
    expect(scoreDecisionHeuristics("   ").score).toBe(0);
  });
});
