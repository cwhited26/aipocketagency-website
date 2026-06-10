import { describe, it, expect } from "vitest";
import {
  WORKFLOW_RECIPES,
  VAULT_CATEGORIES,
  starterSeedRecipes,
  isRecipeUnlocked,
  unlockedRecipeCount,
  getRecipe,
  isRecipeSlug,
  recipeApps,
  type VaultCategory,
} from "../recipes";
import { isAppId } from "@/lib/apps/catalog";
import {
  TIERS,
  isTier,
  WORKFLOW_VAULT_UNLOCK_COUNTS,
  workflowVaultUnlockCount,
  type Tier,
} from "@/lib/personas/tier-caps";

describe("Workflow Vault recipes", () => {
  it("ships exactly 25 recipes with unique slugs", () => {
    expect(WORKFLOW_RECIPES).toHaveLength(25);
    const slugs = new Set(WORKFLOW_RECIPES.map((r) => r.slug));
    expect(slugs.size).toBe(25);
  });

  it("has exactly 5 recipes per category (5 categories)", () => {
    for (const cat of VAULT_CATEGORIES) {
      const inCat = WORKFLOW_RECIPES.filter((r) => r.category === cat);
      expect(inCat, `category ${cat}`).toHaveLength(5);
    }
  });

  it("every recipe has a valid category, tier, and at least one valid App", () => {
    for (const r of WORKFLOW_RECIPES) {
      expect(VAULT_CATEGORIES).toContain(r.category as VaultCategory);
      expect(isTier(r.recommended_tier)).toBe(true);
      expect(r.default_apps.length).toBeGreaterThan(0);
      for (const a of r.default_apps) expect(isAppId(a), `${r.slug}:${a}`).toBe(true);
      expect(recipeApps(r).length).toBe(r.default_apps.length);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.prompt_template.length).toBeGreaterThan(0);
    }
  });

  it("has exactly 5 starter-seed recipes, one per category", () => {
    const seeds = starterSeedRecipes();
    expect(seeds).toHaveLength(5);
    const cats = new Set(seeds.map((r) => r.category));
    expect(cats.size).toBe(5);
  });

  it("free unlock counts match the tier ladder exactly", () => {
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.starter).toBe(3);
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.pro).toBe(5);
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.pro_plus).toBe(10);
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.studio).toBe(18);
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.studio_plus).toBe(25);
    expect(WORKFLOW_VAULT_UNLOCK_COUNTS.enterprise).toBe(25);
  });

  it("the recipe distribution produces the documented unlock counts per tier", () => {
    for (const tier of TIERS) {
      expect(unlockedRecipeCount(tier as Tier), `tier ${tier}`).toBe(
        workflowVaultUnlockCount(tier as Tier),
      );
    }
  });

  it("the $47 Vault purchase unlocks all 25 regardless of tier", () => {
    for (const r of WORKFLOW_RECIPES) {
      expect(isRecipeUnlocked(r, "starter", true)).toBe(true);
    }
  });

  it("getRecipe / isRecipeSlug resolve known and reject unknown slugs", () => {
    expect(getRecipe("quote-follow-up")?.name).toBe("Quote Follow-Up");
    expect(getRecipe("nope")).toBeNull();
    expect(isRecipeSlug("morning-operator-brief")).toBe(true);
    expect(isRecipeSlug("nope")).toBe(false);
  });
});
