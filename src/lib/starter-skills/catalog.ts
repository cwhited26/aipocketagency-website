// catalog.ts — the starter Skills pack (PA-STARTERSKILL-1..6). Reads the generated manifest (no
// runtime fs — the manifest is bundled) and exposes the tier-gating + grouping helpers three
// callers share: the auto-seeder (which skills to copy into a brain), the dispatcher's pre-plan
// resolver (which brain Skills a tier may load), and the Starter Pack surface (badges + View).
//
// The starter pack's tier ladder maps onto the SMB Tier ladder (lib/personas/tier-caps):
//   free        → everyone (the 5 Voice + Style skills)
//   pro_plus    → + Email / Sales / Research + Marketing / Tools (25 total)
//   studio_plus → + Operations / Decision-shape / Visualization (all 36)
// A tier between thresholds inherits everything at or below its rank (studio gets the pro_plus 25).
// The Plug & Play expansion (PA-STARTERSKILL-7) added Marketing (3 · pro_plus), Tools (2 · pro_plus),
// and Visualization (1 · studio_plus).

import { tierRank, type Tier } from "@/lib/personas/tier-caps";
import {
  STARTER_SKILL_MANIFEST,
  type StarterSkillCategory,
  type StarterSkillRecord,
  type StarterSkillTier,
} from "@/data/starter-skills/manifest";

export type { StarterSkillRecord, StarterSkillCategory, StarterSkillTier };

export const STARTER_SKILLS: readonly StarterSkillRecord[] = STARTER_SKILL_MANIFEST;

/** Every starter-pack slug, for the dispatcher's "is this a starter skill?" check. */
export const STARTER_SKILL_SLUGS: ReadonlySet<string> = new Set(
  STARTER_SKILLS.map((s) => s.slug),
);

/** Display order + labels for the Starter Pack surface (the nine-category structure). */
export const STARTER_CATEGORY_ORDER: readonly StarterSkillCategory[] = [
  "voice_style",
  "email_drafting",
  "sales",
  "research",
  "operations",
  "decision_shape",
  "marketing",
  "tool",
  "viz",
];

export const STARTER_CATEGORY_LABELS: Record<StarterSkillCategory, string> = {
  voice_style: "Voice & Style",
  email_drafting: "Email Drafting",
  sales: "Sales",
  research: "Research",
  operations: "Operations",
  decision_shape: "Decisions",
  marketing: "Marketing",
  tool: "Tools",
  viz: "Visualization",
};

/** Reader-friendly label for a starter skill's tier_required (the upgrade-CTA copy). */
export const STARTER_TIER_LABELS: Record<StarterSkillTier, string> = {
  free: "Free",
  pro_plus: "Pro+",
  studio_plus: "Studio+",
  enterprise: "Enterprise",
};

/** The SMB tier whose rank is the unlock threshold for a starter skill's tier_required. */
const TIER_FOR_REQUIRED: Record<StarterSkillTier, Tier> = {
  free: "starter",
  pro_plus: "pro_plus",
  studio_plus: "studio_plus",
  enterprise: "enterprise",
};

/** Look up a starter skill by slug, or null if it isn't one (e.g. an owner-evolved Skill). */
export function starterSkillBySlug(slug: string): StarterSkillRecord | null {
  return STARTER_SKILLS.find((s) => s.slug === slug) ?? null;
}

/** The tier_required for a starter skill slug, or null if the slug isn't in the starter pack. */
export function starterSkillTier(slug: string): StarterSkillTier | null {
  return starterSkillBySlug(slug)?.tierRequired ?? null;
}

/** Pure: does an owner on `ownerTier` have a starter skill whose tier_required is `required`? */
export function tierUnlocksStarterSkill(ownerTier: Tier, required: StarterSkillTier): boolean {
  return tierRank(ownerTier) >= tierRank(TIER_FOR_REQUIRED[required]);
}

/** The starter skills an owner on `ownerTier` has unlocked (the set the seeder copies in). */
export function starterSkillsForTier(ownerTier: Tier): StarterSkillRecord[] {
  return STARTER_SKILLS.filter((s) => tierUnlocksStarterSkill(ownerTier, s.tierRequired));
}

/**
 * The dispatcher tier-gate (PA-STARTERSKILL-3): a brain Skill loads only if it clears the tier gate.
 * A starter-pack slug must be unlocked by the owner's tier; any slug NOT in the starter pack is an
 * owner-evolved / LEARN-phase Skill and always passes (it's the owner's own, not a gated pack skill).
 */
export function tierGateAllowsSkillSlug(ownerTier: Tier, slug: string): boolean {
  const required = starterSkillTier(slug);
  if (required === null) return true;
  return tierUnlocksStarterSkill(ownerTier, required);
}

/** Starter skills grouped by category in display order (Starter Pack surface). */
export function starterSkillsByCategory(): Array<{
  category: StarterSkillCategory;
  label: string;
  skills: StarterSkillRecord[];
}> {
  return STARTER_CATEGORY_ORDER.map((category) => ({
    category,
    label: STARTER_CATEGORY_LABELS[category],
    skills: STARTER_SKILLS.filter((s) => s.category === category),
  }));
}
