// Unit tests for the Signal Catcher's layer-1 gate (lib/signal-catcher/gates
// rewriteProtectedNames) — the deterministic protected-customer-name rewrite that runs on every
// proposal before its card stages. A ritual name rides into every result card and digest the
// ritual ever produces, so a protected name is swapped for the anonymized pattern, never shipped.

import { describe, expect, it } from "vitest";
import { rewriteProtectedNames, scaffoldForSignalProposal } from "../gates";

describe("rewriteProtectedNames", () => {
  it("swaps a protected first name out of the ritual name", () => {
    const got = rewriteProtectedNames("Patrick Follow-Up Check", ["Patrick"]);
    expect(got).toEqual({ name: "Customer Follow-Up Check", rewritten: true });
  });

  it("swaps a full name and a possessive", () => {
    expect(rewriteProtectedNames("Alan Stoll's Weekly Invoice Review", ["Alan Stoll"])).toEqual({
      name: "Customer Weekly Invoice Review",
      rewritten: true,
    });
  });

  it("is case-insensitive and whole-word", () => {
    expect(rewriteProtectedNames("PATRICK pipeline sweep", ["Patrick"]).rewritten).toBe(true);
    // "Patrickson" is a different word — no rewrite.
    expect(rewriteProtectedNames("Patrickson Report", ["Patrick"]).rewritten).toBe(false);
  });

  it("leaves a clean name untouched", () => {
    expect(rewriteProtectedNames("Monday Pipeline Review", ["Patrick", "Alan Stoll"])).toEqual({
      name: "Monday Pipeline Review",
      rewritten: false,
    });
  });
});

describe("scaffoldForSignalProposal", () => {
  it("builds a schema-valid one-task scaffold framing the card copy as the audited output", () => {
    const scaffold = scaffoldForSignalProposal({
      quote: "I keep meaning to check my pipeline every Monday",
      ritualName: "Monday Pipeline Review",
      cadenceSummary: "Every Monday at 8:00 AM",
    });
    expect(scaffold.milestones).toHaveLength(1);
    expect(scaffold.milestones[0].tasks).toHaveLength(1);
    expect(scaffold.milestones[0].tasks[0].expectedOutput).toContain("Monday Pipeline Review");
  });
});
