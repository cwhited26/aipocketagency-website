// poc-variants.ts — the Poc character variant registry (PA-POS-33). Poc is Pocket Agent's
// character: one alien, different props per role. This file is the single map from a persona
// template slug (or a vertical's avatarSlug) to the Poc variant that renders for it, plus the
// file contract for the art at public/avatars/poc/poc-<variant>.png (512×512, transparent).
//
// Pure data + pure functions, no JSX — PersonaAvatar (src/components/personas/avatar.tsx)
// renders from this, and the drift-guard test (poc-variants.test.ts) pins every variant in
// POC_ART_SHIPPED to a file on disk. Swapping placeholder art for Chase's illustrated Poc is
// a file drop per variant; no code changes here.

import { PERSONA_AVATAR_NAMES } from "@/lib/personas/avatars";

export type PocVariant =
  | "default"
  | "glasses"
  | "headset"
  | "clipboard"
  | "spatula"
  | "hammer"
  | "compass"
  | "coffee";

export const POC_VARIANTS: readonly PocVariant[] = [
  "default",
  "glasses",
  "headset",
  "clipboard",
  "spatula",
  "hammer",
  "compass",
  "coffee",
];

/** Everything PersonaAvatar needs to render Poc for one persona slug. */
export interface PocArt {
  variant: PocVariant;
  /** Public path of the Poc PNG, or null when the art for that variant hasn't shipped. */
  src: string | null;
  /** The pre-Poc placeholder SVG slug to fall back to when src is null. */
  fallbackAvatarSlug: string;
  /** Card background behind the transparent PNG — verticals carry their tint. */
  cardClass: string;
}

// The seven role templates (PA-PERSONA-30) — one signature prop per role (§23.1).
const ROLE_VARIANTS: Record<string, PocVariant> = {
  admin: "clipboard",
  sales: "headset",
  followup: "coffee",
  content: "spatula",
  email: "default",
  "lead-research": "glasses",
  "ops-cos": "compass",
};

// The five legacy template keys resolve to role art via avatarSlug upstream, but map here
// too so resolvePocVariant accepts a raw template key as well as an avatar slug.
const LEGACY_TEMPLATE_VARIANTS: Record<string, PocVariant> = {
  vsm: "headset",
  vcsa: "clipboard",
  vom: "compass",
  vr: "clipboard",
  vmd: "spatula",
};

// Vertical avatars (PA-POS-22) render the default Poc on a vertical-tinted card — same
// character, a wash of the vertical's hue behind it. Navy-family tints so the cyan reads.
const VERTICAL_TINTS: Record<string, string> = {
  coach: "bg-[#0c2a1f]",
  consultant: "bg-[#1a1530]",
  contractor: "bg-[#2b2010]",
  "med-spa": "bg-[#2b1220]",
  agency: "bg-[#0c2233]",
  "sales-team": "bg-[#16280f]",
};

// The persona-SVG card navy — the default backdrop behind the transparent Poc PNG.
const POC_CARD_BASE = "bg-[#0a1f28]";

/**
 * Variants whose art file exists at public/avatars/poc/. All eight ship as geometric
 * placeholders today; the drift-guard test pins this set to the files on disk, so a
 * declared-but-unshipped variant fails the build instead of rendering a broken image.
 */
export const POC_ART_SHIPPED: ReadonlySet<PocVariant> = new Set(POC_VARIANTS);

/** Public path for a Poc variant's art file. */
export function pocArtSrc(variant: PocVariant): string {
  return `/avatars/poc/poc-${variant}.png`;
}

/** The Poc variant for a persona template slug or avatar slug. Unknown slugs get default. */
export function resolvePocVariant(templateSlug: string): PocVariant {
  return (
    ROLE_VARIANTS[templateSlug] ?? LEGACY_TEMPLATE_VARIANTS[templateSlug] ?? "default"
  );
}

/** Full render contract for a slug, with an optional explicit variant override. */
export function resolvePocArt(templateSlug: string, override?: PocVariant): PocArt {
  const variant = override ?? resolvePocVariant(templateSlug);
  return {
    variant,
    src: POC_ART_SHIPPED.has(variant) ? pocArtSrc(variant) : null,
    // A known avatar slug keeps its own SVG as the fallback; anything else uses admin,
    // matching avatarSlugForTemplateKey's retired-key behavior.
    fallbackAvatarSlug: PERSONA_AVATAR_NAMES[templateSlug] ? templateSlug : "admin",
    cardClass: VERTICAL_TINTS[templateSlug] ?? POC_CARD_BASE,
  };
}
