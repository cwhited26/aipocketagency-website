// recipes.ts — the AI Workflow Vault's 25 plug-and-play recipes (PA-VAULT-1..6).
//
// Each recipe is a static JSON file in src/data/workflow-vault/ (precedent: the Lead Scout vertical
// packs loader, src/lib/leads/packs.ts). Recipes are content, not rows — installs are rows (see
// installs.ts). This module imports each file, widens it with a structural cast (never `any`), and
// exposes them as an ordered readonly array whose order is the display order on the surface.
//
// Tier-gating is count-based: lower tiers see a subset unlocked and the rest locked behind an upgrade
// (or the $47 Workflow Vault order-bump, which unlocks all 25). The per-recipe recommended_tier drives
// the unlock — a recipe is unlocked when the owner's tier rank reaches the recipe's tier, or when the
// owner holds the vault purchase. The cumulative counts that produces are asserted against
// workflowVaultUnlockCount in the tests so the two never drift.

import { type AppId, isAppId } from "@/lib/apps/catalog";
import { type Tier, tierRank } from "@/lib/personas/tier-caps";

import coldIntroDrafter from "@/data/workflow-vault/cold-intro-drafter.json";
import warmReEngagement from "@/data/workflow-vault/warm-re-engagement.json";
import quoteFollowUp from "@/data/workflow-vault/quote-follow-up.json";
import calendarNudge from "@/data/workflow-vault/calendar-nudge.json";
import boundarySettingDecline from "@/data/workflow-vault/boundary-setting-decline.json";
import dormantSweep14Day from "@/data/workflow-vault/dormant-sweep-14-day.json";
import customerCheckIn30Day from "@/data/workflow-vault/customer-check-in-30-day.json";
import pastCustomerReactivate60Day from "@/data/workflow-vault/past-customer-reactivate-60-day.json";
import postCallSummaryNextStep from "@/data/workflow-vault/post-call-summary-next-step.json";
import quoteAgingChaser from "@/data/workflow-vault/quote-aging-chaser.json";
import youtube3PostRepurpose from "@/data/workflow-vault/youtube-3-post-repurpose.json";
import podcastNewsletterDraft from "@/data/workflow-vault/podcast-newsletter-draft.json";
import customerStoryTestimonial from "@/data/workflow-vault/customer-story-testimonial.json";
import voiceMemoBlogDraft from "@/data/workflow-vault/voice-memo-blog-draft.json";
import competitiveIntelMarketBrief from "@/data/workflow-vault/competitive-intel-market-brief.json";
import verticalPackExpand from "@/data/workflow-vault/vertical-pack-expand.json";
import singleProspectDeepDive from "@/data/workflow-vault/single-prospect-deep-dive.json";
import industryTrendDigest from "@/data/workflow-vault/industry-trend-digest.json";
import competitorPricingWatch from "@/data/workflow-vault/competitor-pricing-watch.json";
import buyerPersonaIcpRefresh from "@/data/workflow-vault/buyer-persona-icp-refresh.json";
import morningOperatorBrief from "@/data/workflow-vault/morning-operator-brief.json";
import salesPipelinePulse from "@/data/workflow-vault/sales-pipeline-pulse.json";
import cashPositionSummary from "@/data/workflow-vault/cash-position-summary.json";
import tomorrowCalendarPrep from "@/data/workflow-vault/tomorrow-calendar-prep.json";
import endOfDayReflection from "@/data/workflow-vault/end-of-day-reflection.json";

export const VAULT_CATEGORIES = [
  "email",
  "follow-up",
  "content",
  "lead-research",
  "daily-brief",
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_LABELS: Record<VaultCategory, string> = {
  email: "Email",
  "follow-up": "Follow-Up",
  content: "Content",
  "lead-research": "Lead Research",
  "daily-brief": "Daily Brief",
};

export type WorkflowRecipe = {
  // slug = filename; filled in below so the JSON files don't repeat their own name.
  slug: string;
  name: string;
  description: string;
  category: VaultCategory;
  default_persona_slug: string;
  prompt_template: string;
  // "" means manual / on-demand (no schedule); otherwise a 5-field cron.
  default_schedule_cron: string;
  default_apps: AppId[];
  recommended_tier: Tier;
  // The five recipes the Launch Kit auto-installs (one per category) for every paid subscription.
  starter_seed: boolean;
};

// Raw JSON shape (slug comes from the import key, not the file).
type RawRecipe = Omit<WorkflowRecipe, "slug">;

// Display order = this list's order (category by category, recipe by recipe). Adding a recipe means
// adding its JSON import + a [slug, json] entry here.
const RAW_RECIPES: ReadonlyArray<readonly [string, RawRecipe]> = [
  ["cold-intro-drafter", coldIntroDrafter as RawRecipe],
  ["warm-re-engagement", warmReEngagement as RawRecipe],
  ["quote-follow-up", quoteFollowUp as RawRecipe],
  ["calendar-nudge", calendarNudge as RawRecipe],
  ["boundary-setting-decline", boundarySettingDecline as RawRecipe],
  ["dormant-sweep-14-day", dormantSweep14Day as RawRecipe],
  ["customer-check-in-30-day", customerCheckIn30Day as RawRecipe],
  ["past-customer-reactivate-60-day", pastCustomerReactivate60Day as RawRecipe],
  ["post-call-summary-next-step", postCallSummaryNextStep as RawRecipe],
  ["quote-aging-chaser", quoteAgingChaser as RawRecipe],
  ["youtube-3-post-repurpose", youtube3PostRepurpose as RawRecipe],
  ["podcast-newsletter-draft", podcastNewsletterDraft as RawRecipe],
  ["customer-story-testimonial", customerStoryTestimonial as RawRecipe],
  ["voice-memo-blog-draft", voiceMemoBlogDraft as RawRecipe],
  ["competitive-intel-market-brief", competitiveIntelMarketBrief as RawRecipe],
  ["vertical-pack-expand", verticalPackExpand as RawRecipe],
  ["single-prospect-deep-dive", singleProspectDeepDive as RawRecipe],
  ["industry-trend-digest", industryTrendDigest as RawRecipe],
  ["competitor-pricing-watch", competitorPricingWatch as RawRecipe],
  ["buyer-persona-icp-refresh", buyerPersonaIcpRefresh as RawRecipe],
  ["morning-operator-brief", morningOperatorBrief as RawRecipe],
  ["sales-pipeline-pulse", salesPipelinePulse as RawRecipe],
  ["cash-position-summary", cashPositionSummary as RawRecipe],
  ["tomorrow-calendar-prep", tomorrowCalendarPrep as RawRecipe],
  ["end-of-day-reflection", endOfDayReflection as RawRecipe],
];

export const WORKFLOW_RECIPES: readonly WorkflowRecipe[] = RAW_RECIPES.map(
  ([slug, raw]) => ({ ...raw, slug }),
);

export function getRecipe(slug: string): WorkflowRecipe | null {
  return WORKFLOW_RECIPES.find((r) => r.slug === slug) ?? null;
}

export function isRecipeSlug(slug: string): boolean {
  return WORKFLOW_RECIPES.some((r) => r.slug === slug);
}

/** The five recipes the Launch Kit seeds for every paid subscription (one per category). */
export function starterSeedRecipes(): WorkflowRecipe[] {
  return WORKFLOW_RECIPES.filter((r) => r.starter_seed);
}

/** Validate a recipe's default_apps against the App catalog; drop anything unknown. */
export function recipeApps(recipe: WorkflowRecipe): AppId[] {
  return recipe.default_apps.filter((a): a is AppId => isAppId(a));
}

/**
 * Is this recipe unlocked for the owner? The $47 Workflow Vault purchase unlocks all 25; otherwise a
 * recipe is unlocked once the owner's tier rank reaches the recipe's recommended_tier. The cumulative
 * count this yields per tier is asserted against workflowVaultUnlockCount in the tests.
 */
export function isRecipeUnlocked(
  recipe: WorkflowRecipe,
  tier: Tier,
  hasVaultPurchase: boolean,
): boolean {
  if (hasVaultPurchase) return true;
  return tierRank(tier) >= tierRank(recipe.recommended_tier);
}

/** How many of the 25 recipes a tier unlocks for free (no vault purchase). */
export function unlockedRecipeCount(tier: Tier): number {
  return WORKFLOW_RECIPES.filter((r) => isRecipeUnlocked(r, tier, false)).length;
}
