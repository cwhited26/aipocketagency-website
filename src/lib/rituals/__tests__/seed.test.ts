// Unit tests for the ritual seed pack + the target resolver (lib/rituals/seed). Asserts the pack is the
// 8 SPEC §10 templates, every seed's target resolves and its cron is computable, ids are unique, and
// the resolver maps catalog Apps, known surfaces, and the unknown case correctly.

import { describe, expect, it } from "vitest";
import { RITUAL_SEEDS, getSeed, resolveRitualTarget } from "../seed";
import { cronNextRun } from "../parser";

describe("RITUAL_SEEDS", () => {
  it("ships exactly 8 templates", () => {
    expect(RITUAL_SEEDS).toHaveLength(8);
  });

  it("has unique seed ids", () => {
    const ids = new Set(RITUAL_SEEDS.map((s) => s.id));
    expect(ids.size).toBe(RITUAL_SEEDS.length);
  });

  it("every seed targets a resolvable App or surface", () => {
    for (const seed of RITUAL_SEEDS) {
      expect(resolveRitualTarget(seed.appSlug), seed.id).not.toBeNull();
    }
  });

  it("every seed's cron is computable", () => {
    const from = new Date("2026-06-08T00:00:00.000Z");
    for (const seed of RITUAL_SEEDS) {
      const next = cronNextRun(seed.cron, from, { biWeekly: seed.biWeekly });
      expect(next, seed.id).not.toBeNull();
    }
  });

  it("getSeed looks a template up by id, null when unknown", () => {
    expect(getSeed("daily-inbox-digest")?.name).toBe("Daily Inbox Digest");
    expect(getSeed("nope")).toBeNull();
  });
});

describe("resolveRitualTarget", () => {
  it("resolves a catalog App", () => {
    const t = resolveRitualTarget("lead-scout");
    expect(t?.label).toBe("Lead Scout");
    expect(t?.href).toBe("/app/apps/lead-scout");
  });

  it("resolves the Decision Roundtable surface (not a catalog App)", () => {
    const t = resolveRitualTarget("decision-roundtable");
    expect(t?.href).toBe("/app/decisions");
  });

  it("returns null for an unknown slug", () => {
    expect(resolveRitualTarget("made-up-app")).toBeNull();
  });
});
