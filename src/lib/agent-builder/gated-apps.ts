// gated-apps.ts — PA-POS-34: the tier gate applies to the COMPOSED SPEC, not the compose
// primitive. After composeToolkit picks the Apps, this maps each one the owner's tier (or an
// active Project Pass) hasn't unlocked into a review-time offer: rent a Project Pass on that
// specific App (PA-POS-31), upgrade, or approve a scoped version without it. Pure given the
// pass list — no I/O, unit-tested directly.

import { appsByIds, sanitizeAppIds, type AppId } from "@/lib/apps/catalog";
import { appMinTier, tierAllowsApp } from "@/lib/apps/slash-commands";
import { getPassDef, passPriceCents, type PassAppSlug } from "@/data/project-passes";
import { activePassForApp, type ProjectPass } from "@/lib/metering/passes";
import { TIER_LABELS, type Tier } from "@/lib/personas/tier-caps";

/** The App ids that map onto a rentable Project Pass (SPEC §21). Decision Roundtable is a
 *  pass-catalog entry with no App tile, so it never appears in a composed toolkit. */
const PASS_SLUG_BY_APP_ID: Partial<Record<AppId, PassAppSlug>> = {
  "landing-page-builder": "landing_page_builder",
  "browser-agent": "browser_agent",
  "idea-engine": "idea_engine",
  "agent-builder": "agent_builder",
};

export type GatedAppOffer = {
  appId: AppId;
  label: string;
  /** The tier that includes this App, in the customer's words ("AI Agent Workspace"). */
  includedInTierLabel: string;
  /** Null when the App has no Project Pass in the catalog — upgrade is the only unlock. */
  passSlug: PassAppSlug | null;
  passPriceCents: number | null;
  passWindowLabel: string | null;
};

/**
 * Which of the composed Apps this owner can't run yet — tier OR active Project Pass, the same
 * `tierAllowsApp` gate the slash dispatcher and Apps grid use, so review-time honesty can never
 * drift from what actually opens.
 */
export function gatedAppOffers(params: {
  tier: Tier;
  passes: readonly ProjectPass[];
  appIds: readonly string[];
  now?: Date;
}): GatedAppOffer[] {
  const now = params.now ?? new Date();
  const passApps: AppId[] = [];
  for (const [appId, slug] of Object.entries(PASS_SLUG_BY_APP_ID) as [AppId, PassAppSlug][]) {
    if (activePassForApp(params.passes, slug, now)) passApps.push(appId);
  }

  const offers: GatedAppOffer[] = [];
  for (const app of appsByIds(sanitizeAppIds(params.appIds))) {
    if (tierAllowsApp(params.tier, app.id, passApps)) continue;
    const passSlug = PASS_SLUG_BY_APP_ID[app.id] ?? null;
    const def = passSlug ? getPassDef(passSlug) : null;
    offers.push({
      appId: app.id,
      label: app.label,
      includedInTierLabel: TIER_LABELS[appMinTier(app.id)],
      passSlug,
      passPriceCents: def ? passPriceCents(def, params.tier) : null,
      passWindowLabel: def?.windowLabel ?? null,
    });
  }
  return offers;
}

/** One review-time sentence for chat surfaces and the compose response. Empty when nothing is
 *  gated. Voice: name the fact, price it plainly, end on the owner's choice. */
export function gatedAppsSentence(offers: readonly GatedAppOffer[]): string {
  if (offers.length === 0) return "";
  const parts = offers.map((o) =>
    o.passPriceCents !== null
      ? `${o.label} (Project Pass $${Math.round(o.passPriceCents / 100)} / ${o.passWindowLabel}, or included in ${o.includedInTierLabel})`
      : `${o.label} (included in ${o.includedInTierLabel})`,
  );
  return `This agent uses ${parts.length === 1 ? "an App" : "Apps"} your plan hasn't unlocked: ${parts.join(
    ", ",
  )}. Approve as-is and it waits until you unlock ${parts.length === 1 ? "it" : "them"} — or approve the scoped version without ${parts.length === 1 ? "it" : "them"}. Your call.`;
}
