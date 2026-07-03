// Registry for the use-case pages at /use-cases/[slug] (PA-POS-25). Lead generation is the
// first fully built page; the other five ship as placeholder doorways that route the reader
// to the Agents Library until their real copy lands. Shared surfaces (the Solutions menu,
// the sitemap, the placeholder shell) read this file so the taxonomy can't drift.
export type UseCaseSlug =
  | "lead-generation"
  | "sales-outreach"
  | "content-creation"
  | "research"
  | "operations"
  | "idea-to-mvp";

export type UseCaseLink = {
  slug: UseCaseSlug;
  /** Short label for the Solutions menu and filter chips — "Lead Generation". */
  label: string;
  /** One-line hook shown in menus and on placeholder pages. */
  hook: string;
  /** Pain-first H1 for the placeholder shell (the built page carries its own). */
  h1: string;
};

export const USE_CASE_LINKS: UseCaseLink[] = [
  {
    slug: "lead-generation",
    label: "Lead Generation",
    hook: "Agents that find prospects, verify the fit, and stage the first touch",
    h1: "Find your next 100 customers without becoming a data analyst.",
  },
  {
    slug: "sales-outreach",
    label: "Sales Outreach",
    hook: "Every follow-up drafted in your voice and staged for one tap",
    h1: "The deals you lose are the ones you forgot to follow up on.",
  },
  {
    slug: "content-creation",
    label: "Content Creation",
    hook: "Newsletters, posts, and pages drafted from what your business already knows",
    h1: "You have ten years of material. You post twice a month.",
  },
  {
    slug: "research",
    label: "Research",
    hook: "Competitor moves, market scans, and call prep filed in your brain",
    h1: "Know what your market is doing without reading the internet all day.",
  },
  {
    slug: "operations",
    label: "Operations",
    hook: "Briefs, digests, triage, and rituals that run whether you remember or not",
    h1: "The office work runs on schedule. You stop being the schedule.",
  },
  {
    slug: "idea-to-mvp",
    label: "Idea to MVP",
    hook: "Drop an idea; approve a plan; get a working product on your own accounts",
    h1: "Your best ideas keep dying in a notes app.",
  },
];

const BY_SLUG = new Map(USE_CASE_LINKS.map((u) => [u.slug, u]));

export function getUseCase(slug: string): UseCaseLink | null {
  return BY_SLUG.get(slug as UseCaseSlug) ?? null;
}

export function otherUseCases(slug: UseCaseSlug): UseCaseLink[] {
  return USE_CASE_LINKS.filter((u) => u.slug !== slug);
}
