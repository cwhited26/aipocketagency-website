// seed.ts — the AI Office Launch Kit seeder. Every paid subscription ships the Launch Kit; this module
// installs the two things that make it real for a new owner:
//   1. The five starter Workflow Vault recipes (PA-LAUNCHKIT-IMPL-3) — ensureLaunchKitSeeded.
//   2. The tier-unlocked starter Skills (PA-STARTERSKILL-4) — copied into the owner's brain as
//      skills/<slug>/SKILL.md (+ versions/v1.md) so the dispatcher loads them before planning.
//
// The starter-skill entry points are all idempotent and resumable (a partial run, a retry, or an
// upgrade re-run only adds what's missing):
//   seedStarterSkills(...)                 — the core: filter by tier, skip what's stamped/already in
//                                            the brain, createSkill the rest, stamp each in pa_starter_skill_seeds.
//   seedStarterSkillsForSubscription(sub)  — the Stripe webhook adapter (customer.subscription.created /
//                                            .updated): resolves owner + tier + brain, then seeds.
//   backfillStarterSkillsForOwner(ownerId) — opportunistic catch-up from the Starter Pack surface, for
//                                            the common case where the brain wasn't connected at subscribe time.

import { seedStarterRecipes } from "@/lib/workflow-vault/installs";
import { createSkill, listSkillSummaries, type SkillRepo } from "@/lib/skills/store";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, resolveProvisionTier, type Tier } from "@/lib/personas/tier-caps";
import { extractPriceIds, type StripeSubscription } from "@/lib/pocket-agent-webhook-tier";
import { fetchPocketAgentBySubscriptionId } from "@/lib/pocket-agent-supabase";
import { starterSkillsForTier } from "@/lib/starter-skills/catalog";
import { listSeededStarterSlugs, recordStarterSkillSeed } from "@/lib/starter-skills/db";

type SeedResult = { ok: true; seeded: number } | { ok: false; error: string };

/**
 * Auto-install the five starter Workflow Vault recipes (PA-LAUNCHKIT-IMPL-3). The three starter
 * Personas are seeded by the Personas onboarding flow already, so the Launch Kit only seeds recipes.
 * Idempotent — re-seeding merges on the install unique index.
 */
export async function ensureLaunchKitSeeded(ownerId: string): Promise<SeedResult> {
  const res = await seedStarterRecipes(ownerId, null);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, seeded: res.data.seeded };
}

// The zone seeded Skills live in — matches the dispatcher's DEFAULT_RUN_ZONE so an ordinary run loads
// them. (Held as a local const to keep the heavy dispatcher module out of the webhook bundle.)
const SEED_ZONE = "project-shared";
const SOURCE_VERSION = "v1";

export type SeedSummary = { seeded: string[]; skipped: number; failed: string[] };

/**
 * Seed the tier-unlocked starter Skills into one owner's brain. Idempotent: skips any slug already
 * stamped in pa_starter_skill_seeds and any slug the brain already has (hand-created, or a prior seed
 * whose stamp didn't land), recording a stamp for the latter so future runs skip it without a brain read.
 */
export async function seedStarterSkills(input: {
  ownerId: string;
  tier: Tier;
  repo: string;
  token: string;
  stampIso: string;
}): Promise<SeedSummary> {
  const summary: SeedSummary = { seeded: [], skipped: 0, failed: [] };
  const unlocked = starterSkillsForTier(input.tier);
  if (unlocked.length === 0) return summary;

  const [alreadySeeded, existing] = await Promise.all([
    listSeededStarterSlugs(input.ownerId),
    listSkillSummaries({ repo: input.repo, token: input.token }),
  ]);
  const existingSlugs = new Set(existing.map((s) => s.slug));
  const ctx: SkillRepo = { repo: input.repo, token: input.token };

  for (const skill of unlocked) {
    if (alreadySeeded.has(skill.slug)) {
      summary.skipped++;
      continue;
    }
    // Already a Skill at this slug: record the stamp so re-runs skip it, but never overwrite the owner's file.
    if (existingSlugs.has(skill.slug)) {
      await recordStarterSkillSeed({
        ownerId: input.ownerId,
        skillSlug: skill.slug,
        sourceVersion: SOURCE_VERSION,
        seededAtIso: input.stampIso,
      });
      summary.skipped++;
      continue;
    }

    const res = await createSkill(
      ctx,
      {
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        whenToUse: skill.whenToUse,
        body: skill.body,
        zone: SEED_ZONE,
        prerequisites: skill.prerequisites,
      },
      input.stampIso,
    );
    if (!res.ok) {
      console.warn("[launch-kit/seed] createSkill failed", { ownerId: input.ownerId, slug: skill.slug, error: res.error });
      summary.failed.push(skill.slug);
      continue;
    }

    const stamp = await recordStarterSkillSeed({
      ownerId: input.ownerId,
      skillSlug: skill.slug,
      sourceVersion: SOURCE_VERSION,
      seededAtIso: input.stampIso,
    });
    if (!stamp.ok) {
      // The SKILL.md is written; only the audit stamp missed. The brain-read guard above makes the
      // next run skip it, so this is non-fatal — log and move on.
      console.warn("[launch-kit/seed] seed stamp failed (file written)", { ownerId: input.ownerId, slug: skill.slug, error: stamp.error });
    }
    summary.seeded.push(skill.slug);
  }
  return summary;
}

/**
 * Resolve an owner's brain + tier and seed. Shared by the webhook adapter and the surface backfill.
 * Returns null (and logs) when there's no connected brain yet — seeding is deferred to a later trigger
 * (an upgrade event, or the Starter Pack backfill once the owner connects their brain).
 */
async function seedForOwner(ownerId: string, tier: Tier, reason: string): Promise<SeedSummary | null> {
  const pa = await fetchPaUser(ownerId);
  const repo = pa.ok && pa.data ? pa.data.brain_repo : null;
  const token = pa.ok && pa.data ? pa.data.github_token : null;
  if (!repo || !token) {
    console.info("[launch-kit/seed] no connected brain — deferring starter-skill seed", { ownerId, tier, reason });
    return null;
  }
  const summary = await seedStarterSkills({ ownerId, tier, repo, token, stampIso: new Date().toISOString() });
  if (summary.seeded.length > 0 || summary.failed.length > 0) {
    console.info("[launch-kit/seed] starter skills seeded", {
      ownerId,
      tier,
      reason,
      seeded: summary.seeded.length,
      skipped: summary.skipped,
      failed: summary.failed.length,
    });
  }
  return summary;
}

/**
 * Stripe webhook entry (PA-STARTERSKILL-4): seed on customer.subscription.created / .updated for any
 * paid tier. Never throws — a seed failure must not break the webhook. The tier comes from the active
 * price IDs (the same source applyPocketAgentTierFromSubscription writes), so an add-on-only or non-PA
 * subscription resolves to null and is skipped.
 */
export async function seedStarterSkillsForSubscription(sub: StripeSubscription): Promise<void> {
  try {
    const tier = resolveProvisionTier({ priceIds: extractPriceIds(sub), metadataTier: sub.metadata?.tier });
    if (!tier) return; // add-on-only / non-PA subscription — no tier to seed against

    let ownerId = sub.metadata?.user_id ?? null;
    if (!ownerId) {
      const lookup = await fetchPocketAgentBySubscriptionId(sub.id);
      ownerId = lookup.ok && lookup.row ? lookup.row.user_id : null;
    }
    if (!ownerId) {
      console.info("[launch-kit/seed] subscription has no linked user yet — deferring seed", { subscriptionId: sub.id, tier });
      return;
    }
    await seedForOwner(ownerId, tier, "subscription");
  } catch (e) {
    console.error("[launch-kit/seed] seedStarterSkillsForSubscription threw", {
      subscriptionId: sub.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Opportunistic catch-up: seed any tier-unlocked starter Skills the owner doesn't have yet. Called
 * from the Starter Pack surface so the pack lands the first time an owner with a connected brain views
 * it — the common path, since the brain is usually connected after the subscription event, not before.
 * Best-effort and idempotent; safe to call on every view (it's a no-op once everything's seeded).
 */
export async function backfillStarterSkillsForOwner(ownerId: string): Promise<SeedSummary | null> {
  try {
    const tier = await getCurrentTier(ownerId);
    return await seedForOwner(ownerId, tier, "backfill");
  } catch (e) {
    console.error("[launch-kit/seed] backfillStarterSkillsForOwner threw", {
      ownerId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
