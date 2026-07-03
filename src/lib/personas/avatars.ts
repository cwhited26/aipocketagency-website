// avatars.ts — the persona avatar file contract (PA-POS-23): slugs, sizes, display names, and
// the public path. Pure data, no JSX — the PersonaAvatar component (src/components/personas/
// avatar.tsx) renders from this, and the avatar drift-guard test pins it against the files in
// public/avatars/personas/.

export type PersonaAvatarSize = "sm" | "md" | "lg" | "xl";

/** Rendered pixel size per variant (the source art is 512×512). */
export const PERSONA_AVATAR_SIZES: Record<PersonaAvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/** Display names for the 13 shipped avatar slugs — the default alt text. */
export const PERSONA_AVATAR_NAMES: Record<string, string> = {
  // The seven role templates (PA-PERSONA-30).
  admin: "Admin Assistant",
  sales: "Sales Assistant",
  followup: "Follow-Up Agent",
  content: "Content Creator",
  email: "Email Drafter",
  "lead-research": "Lead Researcher",
  "ops-cos": "Chief of Staff",
  // The six onboarding verticals (PA-POS-22).
  coach: "Coach",
  consultant: "Consultant",
  contractor: "Contractor",
  "med-spa": "Med spa",
  agency: "Agency",
  "sales-team": "Sales team",
};

/** The public path for an avatar slug. */
export function personaAvatarSrc(slug: string): string {
  return `/avatars/personas/${slug}.svg`;
}
