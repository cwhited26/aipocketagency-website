// vertical-seed.ts — lands the picked vertical's workspace seed: three role Personas from the
// shipped templates (specs written into the OWNER's own brain repo per PA-POS-19, rows in the
// personas table) plus the tier-unlocked Starter Skills backfill. Idempotent and self-healing,
// modeled on lib/launch-kit/seed.ts: the picker usually runs BEFORE a brain exists (it's the
// first onboarding stop), so the pick only stores the decision and this seeder re-runs from
// three triggers — the pick itself (owners who already have a brain), brain connect, and Home
// load — seeding only the missing delta each time.
//
// Tier caps are respected the same way the wizard respects them (canCreatePersona before each
// create): a starter-tier owner (persona cap 0) keeps the vertical but seeds nothing until an
// upgrade, at which point the next trigger completes the delta. personas_seeded_at is stamped
// only once every planned Persona is accounted for.

import { fetchPaUser } from "@/lib/pa-supabase";
import { canCreatePersona } from "@/lib/personas/tier-caps";
import { listPersonasForBusiness, PersonaDbError } from "@/lib/personas/db";
import { getTemplate } from "@/lib/personas/templates";
import { slugifyPersonaName } from "@/lib/personas/types";
import { createPersonaFromTemplate } from "@/lib/personas/create";
import { sanitizeAppIds } from "@/lib/apps/catalog";
import { backfillStarterSkillsForOwner } from "@/lib/launch-kit/seed";
import { getVertical, isVerticalSlug, planVerticalSeed } from "./verticals";
import { fetchOnboardingState, recordSeededPersonas } from "./state-db";
import { onboardingLog } from "./log";

export type VerticalSeedOutcome = {
  /**
   * skipped   — no decision yet, or the owner skipped (empty workspace stays empty)
   * already   — every planned Persona existed before this run
   * deferred  — vertical picked but no brain connected yet; a later trigger completes it
   * seeded    — the plan is fully landed as of this run
   * partial   — some Personas landed, the rest blocked (tier cap or a failed create)
   * error     — the run itself failed; nothing to surface to the owner, it self-heals
   */
  status: "skipped" | "already" | "deferred" | "seeded" | "partial" | "error";
  createdSlugs: string[];
};

/**
 * Ensures the picked vertical's Personas exist. Best-effort and never throws — every caller
 * (the pick route, brain connect, Home load) must succeed regardless of the seed.
 */
export async function ensureVerticalSeed(ownerId: string): Promise<VerticalSeedOutcome> {
  try {
    const state = await fetchOnboardingState(ownerId);
    if (!state?.vertical_picked_at) return { status: "skipped", createdSlugs: [] };
    if (!state.vertical || !isVerticalSlug(state.vertical)) {
      return { status: "skipped", createdSlugs: [] };
    }
    if (state.personas_seeded_at) return { status: "already", createdSlugs: [] };

    const plan = planVerticalSeed(state.vertical);

    const paResult = await fetchPaUser(ownerId);
    const pa = paResult.ok ? paResult.data : null;
    if (!pa?.brain_repo || !pa.github_token) {
      return { status: "deferred", createdSlugs: [] };
    }
    const ctx = { userId: ownerId, brainRepo: pa.brain_repo, githubToken: pa.github_token };

    // What's already in place: roles the owner holds (by template) and slugs this seeder
    // previously created (so an owner-deleted Persona is never resurrected).
    const existing = await listPersonasForBusiness(ownerId);
    const existingTemplates = new Set(existing.map((p) => p.template_key));
    const priorSlugs = new Set(state.seeded_persona_slugs);

    const createdSlugs: string[] = [];
    let blocked = false;

    for (const key of plan.templates) {
      const template = getTemplate(key);
      if (!template) continue;
      const slug = slugifyPersonaName(template.suggestedName);
      if (existingTemplates.has(key) || priorSlugs.has(slug)) continue;

      const cap = await canCreatePersona(ownerId);
      if (!cap.ok) {
        onboardingLog.info("vertical seed paused at persona cap", {
          ownerId,
          vertical: state.vertical,
          template: key,
          reason: cap.reason,
        });
        blocked = true;
        break;
      }

      try {
        const result = await createPersonaFromTemplate({
          ctx,
          template,
          name: template.suggestedName,
          tone: template.defaultTone,
          customFields: {},
          apps: sanitizeAppIds(template.defaultApps),
        });
        if (!result.ok) {
          onboardingLog.warn("vertical seed persona create failed", {
            ownerId,
            vertical: state.vertical,
            template: key,
            status: result.status,
            error: result.error,
          });
          blocked = true;
          break;
        }
        createdSlugs.push(result.persona.slug);
      } catch (e) {
        // A duplicate slug (409) means the role is present under this name — an archived
        // Persona still holds the slug's unique index. Count it satisfied and move on.
        if (e instanceof PersonaDbError && (e.status === 409 || /duplicate|23505/.test(e.message))) {
          createdSlugs.push(slug);
          continue;
        }
        throw e;
      }
    }

    const satisfied = (key: string): boolean => {
      const template = getTemplate(key);
      if (!template) return true;
      const slug = slugifyPersonaName(template.suggestedName);
      return existingTemplates.has(key) || priorSlugs.has(slug) || createdSlugs.includes(slug);
    };
    const complete = plan.templates.every(satisfied);

    if (createdSlugs.length > 0 || complete) {
      await recordSeededPersonas({
        ownerId,
        seededSlugs: [...priorSlugs, ...createdSlugs],
        complete,
      });
    }

    // Land the tier-unlocked Starter Skills alongside the Personas (idempotent; PA-SKILL-6 tier
    // gates apply inside). Only when something moved this run — the pure re-check paths skip it.
    if (createdSlugs.length > 0) {
      await backfillStarterSkillsForOwner(ownerId);
    }

    if (createdSlugs.length > 0) {
      onboardingLog.info("vertical seed run complete", {
        ownerId,
        vertical: state.vertical,
        created: createdSlugs,
        complete,
      });
    }

    if (complete) return { status: createdSlugs.length > 0 ? "seeded" : "already", createdSlugs };
    return { status: blocked || createdSlugs.length > 0 ? "partial" : "deferred", createdSlugs };
  } catch (e) {
    onboardingLog.error("vertical seed run threw", {
      ownerId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { status: "error", createdSlugs: [] };
  }
}

export type HomeVerticalCard = {
  vertical: string;
  verticalLabel: string;
  templateKey: string;
  personaName: string;
  description: string;
  starterPrompt: string;
  avatarSlug: string;
};

/**
 * The example-agent card for the Home dashboard (PA-POS-22): one agent per vertical — the
 * pick's flagship template — with a clone-and-customize CTA. Null when the owner skipped,
 * hasn't decided, or the state read fails (the card is decoration, never a blocker).
 */
export async function homeVerticalCard(ownerId: string): Promise<HomeVerticalCard | null> {
  try {
    const state = await fetchOnboardingState(ownerId);
    if (!state?.vertical || !isVerticalSlug(state.vertical)) return null;
    const def = getVertical(state.vertical);
    if (!def) return null;
    const template = getTemplate(def.exampleTemplate);
    if (!template) return null;
    return {
      vertical: def.slug,
      verticalLabel: def.label,
      templateKey: template.key,
      personaName: template.suggestedName,
      description: template.description,
      starterPrompt: template.starterPrompt,
      avatarSlug: template.avatarSlug,
    };
  } catch (e) {
    onboardingLog.warn("home vertical card read failed", {
      ownerId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
