// seed.test.ts — the starter-skill seeder selects by tier and is idempotent: it skips slugs already
// stamped and slugs already present in the brain (recording a stamp for those), and creates only the
// rest. The brain store + the seed DB are mocked — no network, no GitHub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createSkill: vi.fn(),
  listSkillSummaries: vi.fn(),
  recordStarterSkillSeed: vi.fn(),
  listSeededStarterSlugs: vi.fn(),
}));
const { createSkill, listSkillSummaries, recordStarterSkillSeed, listSeededStarterSlugs } = h;

vi.mock("@/lib/skills/store", () => ({
  createSkill: h.createSkill,
  listSkillSummaries: h.listSkillSummaries,
}));
vi.mock("@/lib/starter-skills/db", () => ({
  recordStarterSkillSeed: h.recordStarterSkillSeed,
  listSeededStarterSlugs: h.listSeededStarterSlugs,
}));

import { seedStarterSkills } from "../seed";

const base = { ownerId: "owner-1", repo: "o/brain", token: "t", stampIso: "2026-06-09T00:00:00.000Z" };

beforeEach(() => {
  createSkill.mockReset();
  recordStarterSkillSeed.mockReset();
  listSkillSummaries.mockReset();
  listSeededStarterSlugs.mockReset();
  createSkill.mockResolvedValue({ ok: true, sha: "abc", version: 1 });
  recordStarterSkillSeed.mockResolvedValue({ ok: true });
  listSkillSummaries.mockResolvedValue([]);
  listSeededStarterSlugs.mockResolvedValue(new Set<string>());
});
afterEach(() => vi.restoreAllMocks());

describe("seedStarterSkills", () => {
  it("seeds the free pack (5) into an empty brain and stamps each", async () => {
    const summary = await seedStarterSkills({ ...base, tier: "starter" });
    expect(summary.seeded).toHaveLength(5);
    expect(summary.skipped).toBe(0);
    expect(createSkill).toHaveBeenCalledTimes(5);
    expect(recordStarterSkillSeed).toHaveBeenCalledTimes(5);
  });

  it("seeds 25 at pro_plus (incl. Plug & Play marketing + tools)", async () => {
    const summary = await seedStarterSkills({ ...base, tier: "pro_plus" });
    expect(summary.seeded).toHaveLength(25);
    expect(createSkill).toHaveBeenCalledTimes(25);
  });

  it("skips already-stamped slugs (idempotent re-run)", async () => {
    listSeededStarterSlugs.mockResolvedValue(new Set(["lead-with-the-action", "dont-be-a-chatbot"]));
    const summary = await seedStarterSkills({ ...base, tier: "starter" });
    expect(summary.seeded).toHaveLength(3);
    expect(summary.skipped).toBe(2);
    expect(createSkill).toHaveBeenCalledTimes(3);
  });

  it("never overwrites a slug already in the brain — stamps it and skips the write", async () => {
    listSkillSummaries.mockResolvedValue([{ slug: "honest-hedging" }]);
    const summary = await seedStarterSkills({ ...base, tier: "starter" });
    expect(summary.seeded).toHaveLength(4);
    expect(summary.skipped).toBe(1);
    expect(createSkill).toHaveBeenCalledTimes(4);
    // The pre-existing slug still gets a stamp so future runs skip it without a brain read.
    expect(recordStarterSkillSeed).toHaveBeenCalledWith(
      expect.objectContaining({ skillSlug: "honest-hedging" }),
    );
  });

  it("reports a createSkill failure without aborting the rest", async () => {
    createSkill.mockResolvedValueOnce({ ok: false, error: "github 502" });
    const summary = await seedStarterSkills({ ...base, tier: "starter" });
    expect(summary.failed).toHaveLength(1);
    expect(summary.seeded).toHaveLength(4);
  });
});
