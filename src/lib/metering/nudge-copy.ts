// Conversion-nudge copy builder (PA-POS-31 amendment) — pure and unit-tested so the voice and
// the autonomy posture are pinned. The card shows the math with the REAL tier that includes the
// App (the SPEC's sample line named Business Agent loosely; Landing Page Builder actually lives
// at Studio — we say the true number or none). Education, never pressure: the copy always ends
// on "up to you," and nothing in this module can gate a purchase or a run.

import { TIERS, type Tier } from "@/lib/personas/tier-caps";
import type { PassAppSlug } from "@/data/project-passes";
import { getPassDef } from "@/data/project-passes";
import { tierIncludesApp } from "./passes";

/** Marketing name + monthly price per tier (the /pricing page columns, left to right). */
const TIER_LABELS: Record<Tier, { name: string; priceLabel: string }> = {
  starter: { name: "Personal Brain", priceLabel: "$37/mo" },
  pro: { name: "Business Agent", priceLabel: "$97/mo" },
  pro_plus: { name: "Pro+", priceLabel: "$149/mo" },
  studio: { name: "Studio", priceLabel: "$297/mo" },
  studio_plus: { name: "AI Agent Workspace", priceLabel: "$497/mo" },
  enterprise: { name: "Enterprise", priceLabel: "custom" },
};

/** The cheapest tier that includes this App outright. */
export function cheapestIncludingTier(appSlug: PassAppSlug): Tier {
  for (const tier of TIERS) {
    if (tierIncludesApp(tier, appSlug)) return tier;
  }
  return "enterprise";
}

export type NudgeCopy = {
  headline: string;
  body: string;
  /** The single CTA — a look at the tiers. Navigation only; never a gate. */
  ctaLabel: string;
  /** The explicit no-pressure exit. Selecting it does nothing but close the card. */
  dismissLabel: string;
};

export function buildNudgeCopy(appSlug: PassAppSlug): NudgeCopy {
  const def = getPassDef(appSlug);
  const label = def?.label ?? "this App";
  const tier = cheapestIncludingTier(appSlug);
  const { name, priceLabel } = TIER_LABELS[tier];

  const body =
    tier === "studio_plus"
      ? `${name} is ${priceLabel} and includes it always — plus every other App we've got. Or keep renting — up to you.`
      : `${name} is ${priceLabel} and includes it always. AI Agent Workspace is $497/mo and includes every App we've got. Or keep renting — up to you.`;

  return {
    headline: `You've rented ${label} twice in three weeks.`,
    body,
    ctaLabel: "See the tiers",
    dismissLabel: "Keep renting",
  };
}
