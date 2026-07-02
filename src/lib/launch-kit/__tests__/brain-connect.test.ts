// brain-connect.test.ts — backfillStarterSkillsOnBrainConnect closes the first-time-buyer race:
// when an owner connects (or reconnects) a brain, it runs the idempotent starter-skill backfill.
// Asserts (a) it fires exactly once per new connect, (b) it's idempotent across reconnects, and
// (c) a tier upgrade seeds only the newly-unlocked delta, not the full pack. The tier resolver, the
// brain store, the PA row, and the seed DB are all mocked — no network, no GitHub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { starterSkillsForTier } from "@/lib/starter-skills/catalog";

const h = vi.hoisted(() => ({
  getCurrentTier: vi.fn(),
  fetchPaUser: vi.fn(),
  createSkill: vi.fn(),
  listSkillSummaries: vi.fn(),
  recordStarterSkillSeed: vi.fn(),
  listSeededStarterSlugs: vi.fn(),
}));

// Partial mock: catalog's tierUnlocksStarterSkill pulls tierRank from this module, so keep the real
// exports and only override the DB-backed getCurrentTier.
vi.mock("@/lib/personas/tier-caps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/personas/tier-caps")>()),
  getCurrentTier: h.getCurrentTier,
}));
vi.mock("@/lib/pa-supabase", () => ({ fetchPaUser: h.fetchPaUser }));
vi.mock("@/lib/skills/store", () => ({
  createSkill: h.createSkill,
  listSkillSummaries: h.listSkillSummaries,
}));
vi.mock("@/lib/starter-skills/db", () => ({
  recordStarterSkillSeed: h.recordStarterSkillSeed,
  listSeededStarterSlugs: h.listSeededStarterSlugs,
}));

import { backfillStarterSkillsOnBrainConnect } from "../seed";

const STARTER_SLUGS = starterSkillsForTier("starter").map((s) => s.slug);
const STARTER_COUNT = STARTER_SLUGS.length; // 5 (free pack)
const PRO_PLUS_COUNT = starterSkillsForTier("pro_plus").length; // 20

beforeEach(() => {
  h.getCurrentTier.mockReset();
  h.fetchPaUser.mockReset();
  h.createSkill.mockReset();
  h.listSkillSummaries.mockReset();
  h.recordStarterSkillSeed.mockReset();
  h.listSeededStarterSlugs.mockReset();

  h.getCurrentTier.mockResolvedValue("starter");
  h.fetchPaUser.mockResolvedValue({ ok: true, data: { brain_repo: "o/brain", github_token: "t" } });
  h.createSkill.mockResolvedValue({ ok: true, sha: "abc", version: 1 });
  h.listSkillSummaries.mockResolvedValue([]);
  h.recordStarterSkillSeed.mockResolvedValue({ ok: true });
  h.listSeededStarterSlugs.mockResolvedValue(new Set<string>());
});
afterEach(() => vi.restoreAllMocks());

describe("backfillStarterSkillsOnBrainConnect", () => {
  it("(a) fires the backfill exactly once on a first brain connect and seeds the unlocked pack", async () => {
    const summary = await backfillStarterSkillsOnBrainConnect({
      ownerId: "owner-1",
      previousRepo: null,
      newRepo: "o/brain",
    });

    // Fired once: tier resolved once, and the full free pack was created.
    expect(h.getCurrentTier).toHaveBeenCalledTimes(1);
    expect(h.createSkill).toHaveBeenCalledTimes(STARTER_COUNT);
    expect(summary?.seeded).toHaveLength(STARTER_COUNT);
  });

  it("(a) does not fire on a no-op re-POST of the same repo", async () => {
    const summary = await backfillStarterSkillsOnBrainConnect({
      ownerId: "owner-1",
      previousRepo: "o/brain",
      newRepo: "o/brain",
    });

    // Guarded off — never even resolves the tier.
    expect(summary).toBeNull();
    expect(h.getCurrentTier).not.toHaveBeenCalled();
    expect(h.createSkill).not.toHaveBeenCalled();
  });

  it("(b) is idempotent across reconnects — a repo change re-fires but seeds nothing already stamped", async () => {
    // The owner already has the whole free pack stamped from the first connect.
    h.listSeededStarterSlugs.mockResolvedValue(new Set(STARTER_SLUGS));

    const summary = await backfillStarterSkillsOnBrainConnect({
      ownerId: "owner-1",
      previousRepo: "o/old-brain",
      newRepo: "o/new-brain",
    });

    // Backfill ran (repo changed) but every unlocked slug was already stamped → no new writes.
    expect(h.getCurrentTier).toHaveBeenCalledTimes(1);
    expect(h.createSkill).not.toHaveBeenCalled();
    expect(summary?.seeded).toHaveLength(0);
    expect(summary?.skipped).toBe(STARTER_COUNT);
  });

  it("(c) a tier upgrade seeds only the newly-unlocked delta, not the full pack", async () => {
    // Owner upgraded starter → pro_plus. The five free skills are already stamped; only the
    // newly-unlocked delta (20 − 5) should be created on this connect.
    h.getCurrentTier.mockResolvedValue("pro_plus");
    h.listSeededStarterSlugs.mockResolvedValue(new Set(STARTER_SLUGS));

    const summary = await backfillStarterSkillsOnBrainConnect({
      ownerId: "owner-1",
      previousRepo: "o/brain",
      newRepo: "o/brain-2",
    });

    const delta = PRO_PLUS_COUNT - STARTER_COUNT;
    expect(h.createSkill).toHaveBeenCalledTimes(delta);
    expect(summary?.seeded).toHaveLength(delta);
    expect(summary?.skipped).toBe(STARTER_COUNT);
  });

  it("no-ops when the new repo is empty", async () => {
    const summary = await backfillStarterSkillsOnBrainConnect({
      ownerId: "owner-1",
      previousRepo: null,
      newRepo: "",
    });
    expect(summary).toBeNull();
    expect(h.getCurrentTier).not.toHaveBeenCalled();
  });
});
