// types.ts — the Landing Page Builder domain types (PA-LPB-1..6).
//
// A landing page is built by a one-tap wrapper around the shipped Build Tools: the owner describes the
// page, PA picks a template, writes the copy in the owner's voice, generates the Next.js component
// code, and stages each connector step (create repo → push files → create Vercel project → deploy)
// for approval. Pure types + small value enums — no I/O — so they import safely into both server
// routes and client components.

/** The kinds of section a template can carry. The kind drives the copy prompt framing + the layout. */
export type SectionKind =
  | "hero"
  | "problem"
  | "mechanism"
  | "pricing"
  | "cta"
  | "bio"
  | "offerings"
  | "before_after"
  | "tier_comparison"
  | "lead_magnet";

/**
 * One section of a landing page. `key` is the stable identifier the generated copy is keyed on and
 * the component template references; it never changes once shipped (the persisted generated_copy is
 * keyed on it).
 */
export type SectionSpec = {
  key: string;
  kind: SectionKind;
  /** Owner-facing name of the section ("Hero", "The problem"). */
  label: string;
  /** What the section is for — fed into the copy prompt so the model writes the right thing. */
  purpose: string;
};

/** The three starter templates (PA-LPB-2). */
export type TemplateId = "single-cta" | "vertical-pack" | "personal-brand";

export const TEMPLATE_IDS: readonly TemplateId[] = [
  "single-cta",
  "vertical-pack",
  "personal-brand",
] as const;

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * A landing page template: an ordered set of sections, the per-section copy prompts the generator
 * injects into Claude, and the Next.js page component skeleton. The skeleton carries a single
 * `{{COPY_JSON}}` placeholder that the assembler fills with the generated copy as a typed `copy`
 * constant — so the copy is injected as data, never spliced into JSX (no escaping hazard).
 */
export type LandingTemplate = {
  /** A starter template id ("single-cta") or a gallery direction ref ("direction:<slug>"). */
  id: string;
  label: string;
  /** Owner-facing one-liner on the template picker. */
  description: string;
  /** Who this template is the right call for. */
  bestFor: string;
  sections: SectionSpec[];
  /** sectionKey → the instruction injected into the copy model for that section. */
  defaultCopyPrompts: Record<string, string>;
  /** The Next.js app/page.tsx skeleton with a `{{COPY_JSON}}` placeholder. */
  componentTemplate: string;
  /**
   * The full design spec the code generator follows (Template Gallery directions carry the brain's
   * direction file here, PA-TG-7). Absent on the three starter templates.
   */
  designBrief?: string;
};

/** The copy the model produced, keyed by section key. */
export type GeneratedCopy = Record<string, string>;

/** The generation output persisted on the page row: the copy strings + the assembled project files. */
export type GeneratedBundle = {
  copy: GeneratedCopy;
  /** Deployable Next.js project files, keyed by repo-relative path. */
  files: Record<string, string>;
};

export type LandingPageStatus = "planning" | "building" | "live" | "failed";

/**
 * The build cursor. Names the connector step currently staged for approval, or a terminal phase.
 * The advance-on-approval state machine moves it forward one step per approved connector action.
 */
export type BuildStep = "plan" | "repo" | "push" | "project" | "deploy" | "live" | "failed";

/** A row of pa_landing_pages (migrations 064 + 079). */
export type LandingPageRow = {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  description: string;
  template: string;
  /** Repo-relative scope path, or null for the owner brain root (PA-LPB-7). Migration 079. */
  brain_scope: string | null;
  /** Domain from the scope's brand.json at create-time. When set and the page goes live, the
   *  Builder stages a Vercel attachDomain approval (PA-LPB-9, locked answer #4). Migration 079. */
  brain_scope_domain: string | null;
  generated_copy: GeneratedBundle | null;
  github_repo_name: string | null;
  vercel_project_id: string | null;
  vercel_url: string | null;
  custom_domain: string | null;
  status: LandingPageStatus;
  build_step: BuildStep;
  created_at: string;
  updated_at: string;
};

/** The trimmed view the App surface renders (no internal generation blob). */
export type LandingPageView = {
  id: string;
  title: string;
  description: string;
  /** A starter template id or a gallery direction ref ("direction:<slug>"). */
  template: string;
  /** Repo-relative scope path, or null for the owner brain root (PA-LPB-7). */
  brainScope: string | null;
  status: LandingPageStatus;
  buildStep: BuildStep;
  githubRepoName: string | null;
  vercelUrl: string | null;
  customDomain: string | null;
  createdAt: string;
  updatedAt: string;
};
