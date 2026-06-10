import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  STARTER_SKILLS,
  STARTER_SKILL_SLUGS,
  STARTER_CATEGORY_ORDER,
  starterSkillsForTier,
  tierUnlocksStarterSkill,
  tierGateAllowsSkillSlug,
  starterSkillTier,
  starterSkillsByCategory,
} from "../catalog";

const DATA_DIR = join(process.cwd(), "src", "data", "starter-skills");

describe("starter skills manifest invariants", () => {
  it("ships exactly 30 skills with unique slugs", () => {
    expect(STARTER_SKILLS).toHaveLength(30);
    expect(STARTER_SKILL_SLUGS.size).toBe(30);
  });

  it("has the documented per-category counts", () => {
    const counts = Object.fromEntries(
      STARTER_CATEGORY_ORDER.map((c) => [c, STARTER_SKILLS.filter((s) => s.category === c).length]),
    );
    expect(counts).toEqual({
      voice_style: 5,
      email_drafting: 5,
      sales: 5,
      research: 5,
      operations: 5,
      decision_shape: 5,
    });
  });

  it("uses only the documented tier ladder, with the right bucket per category", () => {
    for (const s of STARTER_SKILLS) {
      if (s.category === "voice_style") expect(s.tierRequired).toBe("free");
      else if (["email_drafting", "sales", "research"].includes(s.category))
        expect(s.tierRequired).toBe("pro_plus");
      else expect(s.tierRequired).toBe("studio_plus");
    }
  });

  it("every skill has a body, a description, and a when_to_use", () => {
    for (const s of STARTER_SKILLS) {
      expect(s.body.length).toBeGreaterThan(80);
      expect(s.body).toContain("## The technique");
      expect(s.description.length).toBeGreaterThan(10);
      expect(s.whenToUse.length).toBeGreaterThan(10);
    }
  });
});

describe("tier gating (PA-STARTERSKILL-3)", () => {
  it("seeds 5 / 20 / 30 at the named thresholds", () => {
    expect(starterSkillsForTier("starter")).toHaveLength(5); // free voice pack
    expect(starterSkillsForTier("pro_plus")).toHaveLength(20);
    expect(starterSkillsForTier("studio_plus")).toHaveLength(30);
    expect(starterSkillsForTier("enterprise")).toHaveLength(30);
  });

  it("inherits lower tiers for in-between plans", () => {
    expect(starterSkillsForTier("pro")).toHaveLength(5); // below pro_plus → free only
    expect(starterSkillsForTier("studio")).toHaveLength(20); // ≥ pro_plus, < studio_plus
  });

  it("tierUnlocksStarterSkill respects the ladder", () => {
    expect(tierUnlocksStarterSkill("starter", "free")).toBe(true);
    expect(tierUnlocksStarterSkill("pro", "pro_plus")).toBe(false);
    expect(tierUnlocksStarterSkill("studio_plus", "studio_plus")).toBe(true);
    expect(tierUnlocksStarterSkill("enterprise", "studio_plus")).toBe(true);
  });

  it("lets any non-starter (owner-evolved) slug through the gate", () => {
    expect(tierGateAllowsSkillSlug("starter", "draft-roof-supplement-quote")).toBe(true);
    expect(starterSkillTier("draft-roof-supplement-quote")).toBeNull();
  });

  it("gates a starter slug by its tier", () => {
    expect(tierGateAllowsSkillSlug("starter", "inbox-triage")).toBe(false); // studio_plus skill
    expect(tierGateAllowsSkillSlug("studio_plus", "inbox-triage")).toBe(true);
    expect(tierGateAllowsSkillSlug("starter", "lead-with-the-action")).toBe(true); // free skill
  });
});

describe("grouping", () => {
  it("returns six categories in display order, each non-empty", () => {
    const grouped = starterSkillsByCategory();
    expect(grouped.map((g) => g.category)).toEqual(STARTER_CATEGORY_ORDER as unknown as string[]);
    for (const g of grouped) expect(g.skills.length).toBe(5);
  });
});

describe("manifest matches the committed .md files (drift guard)", () => {
  it("every skill has a matching <category>/<slug>.md whose body equals the manifest body", () => {
    for (const s of STARTER_SKILLS) {
      const raw = readFileSync(join(DATA_DIR, s.category, `${s.slug}.md`), "utf8");
      // Frontmatter carries the slug as `name` and the tier; the body is everything after the fence.
      expect(raw).toContain(`name: ${s.slug}`);
      expect(raw).toContain(`tier_required: ${s.tierRequired}`);
      expect(raw).toContain(`category: ${s.category}`);
      const afterFm = raw.slice(raw.indexOf("---", 3) + 3).trim();
      expect(afterFm).toBe(s.body);
    }
  });

  it("has no orphan .md files outside the manifest", () => {
    let fileCount = 0;
    for (const cat of STARTER_CATEGORY_ORDER) {
      for (const f of readdirSync(join(DATA_DIR, cat))) {
        if (f.endsWith(".md")) fileCount++;
      }
    }
    expect(fileCount).toBe(STARTER_SKILLS.length);
  });
});
