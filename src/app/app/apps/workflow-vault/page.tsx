import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import {
  getCurrentTier,
  TIER_LABELS,
  type Tier,
} from "@/lib/personas/tier-caps";
import {
  WORKFLOW_RECIPES,
  isRecipeUnlocked,
  unlockedRecipeCount,
} from "@/lib/workflow-vault/recipes";
import { listVaultInstalls, ownerHasVaultPurchase } from "@/lib/workflow-vault/installs";
import WorkflowVaultClient, { type RecipeView } from "./WorkflowVaultClient";

export const dynamic = "force-dynamic";

export default async function WorkflowVaultPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const [tier, hasVault, installsResult] = await Promise.all([
    getCurrentTier(user.id),
    ownerHasVaultPurchase(user.id),
    listVaultInstalls(user.id),
  ]);
  const installs = installsResult.ok ? installsResult.data : [];

  const recipes: RecipeView[] = WORKFLOW_RECIPES.map((recipe) => {
    const install = installs.find((i) => i.recipe_slug === recipe.slug);
    return {
      slug: recipe.slug,
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      recommendedTierLabel: TIER_LABELS[recipe.recommended_tier as Tier],
      unlocked: isRecipeUnlocked(recipe, tier, hasVault),
      installed: Boolean(install),
      scheduleActive: install?.schedule_active ?? false,
      hasSchedule: recipe.default_schedule_cron !== "",
    };
  });

  return (
    <WorkflowVaultClient
      recipes={recipes}
      tierLabel={TIER_LABELS[tier]}
      unlockedCount={unlockedRecipeCount(tier)}
      totalCount={WORKFLOW_RECIPES.length}
      hasVault={hasVault}
    />
  );
}
