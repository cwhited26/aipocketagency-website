import { describe, it, expect } from "vitest";
import {
  affordancesFor,
  isInformational,
  type InboxItemKind,
} from "./inbox-affordances";

// Every InboxItemKind, listed explicitly. If the union grows, this array must grow
// too — the "every kind resolves" test below fails loudly until it does, which is
// the point: no kind ships without a deliberate affordance decision.
const ALL_KINDS: InboxItemKind[] = [
  "draft",
  "decision",
  "email_triage",
  "persona_lead",
  "action_approval",
  "sub_agent_activity",
  "routine_output",
  "cost_budget_gate",
  "skill_evolution_proposal",
];

// Kinds that commit a real-world / irreversible write ONLY because the user approved
// — these are the only kinds allowed to show an approve/reject button. A skill_evolution_proposal
// writes a versioned SKILL.md to the brain on approval, so it belongs here.
const ACTION_KINDS: InboxItemKind[] = [
  "draft",
  "decision",
  "action_approval",
  "skill_evolution_proposal",
];

// Kinds that are pure outputs the user reads and clears — nothing fires either way.
const INFORMATIONAL_KINDS: InboxItemKind[] = [
  "email_triage",
  "persona_lead",
  "sub_agent_activity",
  "routine_output",
  "cost_budget_gate",
];

describe("affordancesFor", () => {
  it("resolves a non-empty (or deliberately empty) set for every kind", () => {
    for (const kind of ALL_KINDS) {
      const set = affordancesFor(kind);
      expect(set).toBeDefined();
      expect(Array.isArray(set.affordances)).toBe(true);
    }
  });

  it("uses stable, unique affordance keys within each kind", () => {
    for (const kind of ALL_KINDS) {
      const keys = affordancesFor(kind).affordances.map((a) => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives routine_output exactly Mark as read / Save to brain / Dismiss — never approve", () => {
    const set = affordancesFor("routine_output");
    expect(set.hasApproval).toBe(false);
    expect(set.affordances.map((a) => a.key)).toEqual([
      "mark_read",
      "save_to_brain",
      "dismiss",
    ]);
    expect(set.affordances.map((a) => a.key)).not.toContain("approve");
    expect(set.affordances.map((a) => a.key)).not.toContain("reject");
  });

  it("gives action kinds an approve affordance", () => {
    for (const kind of ACTION_KINDS) {
      const keys = affordancesFor(kind).affordances.map((a) => a.key);
      expect(affordancesFor(kind).hasApproval).toBe(true);
      expect(keys).toContain("approve");
    }
  });
});

describe("isInformational (the core invariant)", () => {
  it("flags exactly the informational kinds", () => {
    for (const kind of INFORMATIONAL_KINDS) {
      expect(isInformational(kind)).toBe(true);
    }
    for (const kind of ACTION_KINDS) {
      expect(isInformational(kind)).toBe(false);
    }
  });

  it("guarantees no informational kind carries an approve or reject button", () => {
    for (const kind of INFORMATIONAL_KINDS) {
      const keys = affordancesFor(kind).affordances.map((a) => a.key);
      expect(keys).not.toContain("approve");
      expect(keys).not.toContain("reject");
    }
  });
});
