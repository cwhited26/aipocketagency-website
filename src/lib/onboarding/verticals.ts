// verticals.ts — the six verticals behind the onboarding picker (PA-POS-22). One vertical =
// one of the ICP niches from the Positioning Lock §3 (owner-led $250K–$5M businesses), mapped
// onto the same six doors the marketing site ships at /for/[persona] (PA-POS-17). Picking a
// vertical seeds the workspace: three role Personas from the shipped templates (PA-PERSONA-30),
// the tier-unlocked Starter Skills pack, and the Apps those Personas carry. "Other / skip" is
// the escape hatch — no vertical stored, nothing seeded, straight to the empty workspace.
//
// This module is pure data + pure helpers (no IO) so the picker page, the seeder, the marketing
// pages, and the tests all read one source of truth.

import { getTemplate, type PersonaTemplate } from "@/lib/personas/templates";
import { sanitizeAppIds, type AppId } from "@/lib/apps/catalog";

export const VERTICAL_SLUGS = [
  "coach",
  "consultant",
  "contractor",
  "med-spa",
  "agency",
  "sales-team",
] as const;

export type VerticalSlug = (typeof VERTICAL_SLUGS)[number];

export type VerticalDef = {
  slug: VerticalSlug;
  /** Tile label — "Coach", "Med spa". */
  label: string;
  /** Longer qualifier under the label — who this door is for. */
  who: string;
  /** One line of this owner's day — the problem, not the promise. */
  day: string;
  /** Placeholder avatar slug (public/avatars/personas/<slug>.svg). Same as the vertical slug. */
  avatarSlug: string;
  /** The three role Persona templates seeded on pick (keys into src/lib/personas/templates.ts). */
  personaTemplates: [string, string, string];
  /** The one template shown as the example agent card on Home after seeding. */
  exampleTemplate: string;
  /** The /for/[persona] marketing page slug this vertical maps to. */
  marketingSlug: string;
};

export const VERTICALS: VerticalDef[] = [
  {
    slug: "coach",
    label: "Coach",
    who: "Life, business, or executive coaching",
    day: "Client sessions all day; recaps, check-ins, and content wait for the weekend.",
    avatarSlug: "coach",
    personaTemplates: ["admin", "sales", "content"],
    exampleTemplate: "content",
    marketingSlug: "coaches",
  },
  {
    slug: "consultant",
    label: "Consultant",
    who: "Solo consultant or small firm",
    day: "Billable hours up front; proposals and follow-up eat the evenings.",
    avatarSlug: "consultant",
    personaTemplates: ["admin", "sales", "followup"],
    exampleTemplate: "sales",
    marketingSlug: "consultants",
  },
  {
    slug: "contractor",
    label: "Contractor",
    who: "Roofing, HVAC, home services",
    day: "Days on the roof or in the truck; quotes and office work stack up at home.",
    avatarSlug: "contractor",
    personaTemplates: ["admin", "followup", "ops-cos"],
    exampleTemplate: "followup",
    marketingSlug: "contractors",
  },
  {
    slug: "med-spa",
    label: "Med spa",
    who: "Owner-operator with a small staff",
    day: "Treatment rooms booked solid; rebooking, reviews, and front-desk email slip.",
    avatarSlug: "med-spa",
    personaTemplates: ["admin", "followup", "content"],
    exampleTemplate: "followup",
    marketingSlug: "med-spas",
  },
  {
    slug: "agency",
    label: "Agency",
    who: "Marketing, dev shop, or creative studio",
    day: "Client work ships; your own updates, proposals, and lead research don't.",
    avatarSlug: "agency",
    personaTemplates: ["email", "lead-research", "ops-cos"],
    exampleTemplate: "ops-cos",
    marketingSlug: "agencies",
  },
  {
    slug: "sales-team",
    label: "Sales team",
    who: "Owner-led, sales-heavy SMB",
    day: "Pipeline moves when you push it; follow-up dies the week you're closing.",
    avatarSlug: "sales-team",
    personaTemplates: ["sales", "followup", "lead-research"],
    exampleTemplate: "sales",
    marketingSlug: "sales-teams",
  },
];

export function isVerticalSlug(value: string): value is VerticalSlug {
  return (VERTICAL_SLUGS as readonly string[]).includes(value);
}

export function getVertical(slug: string): VerticalDef | null {
  return VERTICALS.find((v) => v.slug === slug) ?? null;
}

/** The vertical behind a /for/[persona] marketing page, e.g. "coaches" → coach. */
export function verticalForMarketingSlug(marketingSlug: string): VerticalDef | null {
  return VERTICALS.find((v) => v.marketingSlug === marketingSlug) ?? null;
}

/** The three seeded templates, resolved. Throws in tests (not at runtime) if a key drifts. */
export function verticalTemplates(vertical: VerticalDef): PersonaTemplate[] {
  const out: PersonaTemplate[] = [];
  for (const key of vertical.personaTemplates) {
    const t = getTemplate(key);
    if (t) out.push(t);
  }
  return out;
}

/** The Apps a vertical suggests — the union of its seeded templates' defaultApps, catalog order. */
export function suggestedAppsForVertical(vertical: VerticalDef): AppId[] {
  const ids = verticalTemplates(vertical).flatMap((t) => t.defaultApps);
  return sanitizeAppIds([...new Set(ids)]);
}

export type VerticalSeedPlan = {
  vertical: VerticalSlug | null;
  /** Template keys to seed as Personas. Empty on skip. */
  templates: string[];
  /** Apps suggested for the workspace (union of the templates' defaultApps). Empty on skip. */
  apps: AppId[];
};

/**
 * The pure seed plan for a decision: a picked vertical seeds its three role Personas + their
 * Apps; a skip (null) seeds nothing — the owner asked for the empty workspace.
 */
export function planVerticalSeed(vertical: VerticalSlug | null): VerticalSeedPlan {
  if (!vertical) return { vertical: null, templates: [], apps: [] };
  const def = getVertical(vertical);
  if (!def) return { vertical: null, templates: [], apps: [] };
  return {
    vertical: def.slug,
    templates: [...def.personaTemplates],
    apps: suggestedAppsForVertical(def),
  };
}
