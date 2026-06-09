import { describe, it, expect } from "vitest";
import {
  skillLearnGuard,
  isProposalSuppressed,
  readRunSpec,
  classifySkillFromRun,
  type SkillLearnLlm,
} from "../learn";
import type { InboxItem } from "@/lib/pa-inbox-items";

function inbox(over: Partial<InboxItem>): InboxItem {
  return {
    id: "i1",
    user_id: "u1",
    kind: "skill_evolution_proposal",
    title: "t",
    body_md: null,
    source: "skill-learn",
    payload: {},
    status: "pending",
    created_at: "2026-06-09T00:00:00Z",
    resolved_at: null,
    resolved_by: null,
    expires_at: null,
    ...over,
  };
}

describe("skillLearnGuard (poisoning defense, PA-SKILL-7)", () => {
  it("allows a succeeded, trusted run", () => {
    expect(skillLearnGuard({ status: "done", untrusted_origin: false })).toEqual({ ok: true });
  });
  it("bars a failed/canceled run", () => {
    expect(skillLearnGuard({ status: "failed", untrusted_origin: false })).toEqual({
      ok: false,
      skip: "run_not_successful",
    });
  });
  it("bars an untrusted-origin run even when it succeeded", () => {
    expect(skillLearnGuard({ status: "done", untrusted_origin: true })).toEqual({
      ok: false,
      skip: "untrusted_origin",
    });
  });
});

describe("isProposalSuppressed (no re-proposing a rejected/queued write)", () => {
  it("suppresses a pending duplicate", () => {
    const existing = [inbox({ status: "pending", payload: { slug: "x", action: "new" } })];
    expect(isProposalSuppressed({ action: "new", slug: "x" }, existing)).toBe(true);
  });
  it("suppresses a previously-rejected write", () => {
    const existing = [inbox({ status: "rejected", payload: { slug: "x", action: "update" } })];
    expect(isProposalSuppressed({ action: "update", slug: "x" }, existing)).toBe(true);
  });
  it("does not suppress a different slug/action or a non-skill item", () => {
    const existing = [
      inbox({ status: "rejected", payload: { slug: "y", action: "new" } }),
      inbox({ kind: "draft", status: "rejected", payload: { slug: "x", action: "new" } }),
      inbox({ status: "approved", payload: { slug: "x", action: "new" } }),
    ];
    expect(isProposalSuppressed({ action: "new", slug: "x" }, existing)).toBe(false);
  });
});

describe("readRunSpec", () => {
  it("extracts goal, zone, and loaded slugs with defaults", () => {
    expect(readRunSpec({ goal: "do it", zone: "persona-vsm", loadedSkillSlugs: ["a", "b"] })).toEqual({
      goal: "do it",
      zone: "persona-vsm",
      loadedSkillSlugs: ["a", "b"],
    });
    expect(readRunSpec({})).toEqual({ goal: "", zone: "project-shared", loadedSkillSlugs: [] });
    expect(readRunSpec(null)).toEqual({ goal: "", zone: "project-shared", loadedSkillSlugs: [] });
  });
});

describe("classifySkillFromRun", () => {
  const input = { goal: "draft a supplement", resultSummary: "approved", candidates: [] };

  it("parses a 'new' decision", async () => {
    const llm: SkillLearnLlm = async () => ({
      ok: true,
      text: '{"action":"new","name":"Draft Supplement","body":"1. read photos","reason":"3rd time"}',
    });
    const d = await classifySkillFromRun(input, llm);
    expect(d.action).toBe("new");
    expect(d.name).toBe("Draft Supplement");
  });

  it("parses an 'update' decision with a fenced block", async () => {
    const llm: SkillLearnLlm = async () => ({
      ok: true,
      text: 'Sure:\n```json\n{"action":"update","targetSlug":"draft-supplement","body":"add depreciation line"}\n```',
    });
    const d = await classifySkillFromRun(input, llm);
    expect(d.action).toBe("update");
    expect(d.targetSlug).toBe("draft-supplement");
  });

  it("defaults to 'none' on garbage, empty, or an LLM error", async () => {
    expect((await classifySkillFromRun(input, async () => ({ ok: true, text: "no json here" }))).action).toBe("none");
    expect((await classifySkillFromRun(input, async () => ({ ok: true, text: '{"action":"banana"}' }))).action).toBe("none");
    expect((await classifySkillFromRun(input, async () => ({ ok: false, error: "boom" }))).action).toBe("none");
    expect(
      (await classifySkillFromRun(input, async () => {
        throw new Error("network");
      })).action,
    ).toBe("none");
  });
});
