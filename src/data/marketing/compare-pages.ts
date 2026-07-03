// Registry for the five compare pages at /compare/[slug] (PA-POS-19). The full copy
// lives in each page file under src/app/(marketing)/compare/ — this file only carries
// what shared surfaces need: the /compare index cards and the cross-link chip strip.
export type CompareLink = {
  slug: string;
  /** Competitor display name — "Twin", "Claude Cowork". */
  label: string;
  /** One-line hook shown on the index page and in chip tooltips. */
  hook: string;
};

export const COMPARE_LINKS: CompareLink[] = [
  {
    slug: "twin",
    label: "Twin",
    hook: "Twin builds agents inside their app. Pocket Agent builds them inside your GitHub.",
  },
  {
    slug: "catch",
    label: "Catch",
    hook: "Catch is the admin. Pocket Agent is the whole office.",
  },
  {
    slug: "lindy",
    label: "Lindy",
    hook: "Lindy sells templates. Pocket Agent gives you the whole stack — plus the room to change it.",
  },
  {
    slug: "zapier",
    label: "Zapier",
    hook: "Zapier maps steps. Pocket Agent hires the workers.",
  },
  {
    slug: "claude-cowork",
    label: "Claude Cowork",
    hook: "Cowork drafts. Pocket Agent drafts, sends, follows up, and lands the deal.",
  },
];

export function otherCompares(slug: string): CompareLink[] {
  return COMPARE_LINKS.filter((c) => c.slug !== slug);
}
