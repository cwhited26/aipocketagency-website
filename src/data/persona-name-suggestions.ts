// persona-name-suggestions.ts — PA-POS-35. Static suggestion sets for the
// "Give this one a name?" chip that surfaces after a Persona is seeded (vertical
// picker + Agent Builder). Three human names per role category plus a
// "Something else" free-text path in the UI. The names are flavor, not identity —
// Poc stays the visual constant (PA-POS-33); the display name is the one thing the
// owner personalizes.

export const PERSONA_NAME_CATEGORIES = [
  "sales",
  "admin",
  "content",
  "research",
  "ops",
  "followup",
  "email",
] as const;

export type PersonaNameCategory = (typeof PERSONA_NAME_CATEGORIES)[number];

export const PERSONA_NAME_SUGGESTIONS: Record<PersonaNameCategory, readonly string[]> = {
  sales: ["Marcus", "Priya", "Diego"],
  admin: ["Alfred", "Donna", "Ida"],
  content: ["June", "Rhea", "Tobias"],
  research: ["Nia", "Owen", "Vale"],
  ops: ["Kade", "Rosa", "Sina"],
  followup: ["Jamie", "Reeve", "Sol"],
  email: ["Ellis", "Nova", "Wren"],
};

// Template key → suggestion category. The five legacy vertical templates map onto
// the nearest role the same way their avatars do (templates.ts avatarSlug comment).
const TEMPLATE_KEY_TO_CATEGORY: Record<string, PersonaNameCategory> = {
  sales: "sales",
  vsm: "sales",
  admin: "admin",
  vcsa: "admin",
  content: "content",
  vmd: "content",
  "lead-research": "research",
  vr: "research",
  "ops-cos": "ops",
  vom: "ops",
  followup: "followup",
  email: "email",
};

/** The three suggested names for a persona's template. Unknown keys get the admin set. */
export function suggestedNamesForTemplateKey(templateKey: string): readonly string[] {
  return PERSONA_NAME_SUGGESTIONS[TEMPLATE_KEY_TO_CATEGORY[templateKey] ?? "admin"];
}
