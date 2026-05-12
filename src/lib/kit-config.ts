/**
 * Single source of truth for every APA $15 kit.
 *
 * Per `APA/Products/Digital_Product_Pipeline_Playbook.md`:
 *   - One Stripe webhook (`/api/stripe/webhook`) branches on `lead.source` to pick the PDF
 *   - One lead-capture surface (`/api/apa/leads`) validates `source` against this map
 *   - Price IDs are resolved at runtime from Stripe via `metadata.kit_slug` lookup (1-hour cache)
 *   - One generic success route (`/<kit-slug>/success`) reads this map for display copy
 *   - Drip rows filter on `apa_drip_emails.kit_source` matching the slug
 *
 * Adding a new kit: append one entry here and (a) create Stripe product+price with
 * `metadata.kit_slug = '<slug>'`, (b) build the PDF via `bun run pdf:build <slug>`,
 * (c) decide whether the kit gets its own drip rows or rides the generic nurture.
 */

export type KitSlug =
  | "dispatch-playbook"
  | "dev-team-document-set"
  | "claude-md-template-library"
  | "discovery-to-mvp-prompt-pack"
  | "wire-brain-to-stack-guide";

export type KitConfig = {
  slug: KitSlug;
  /** Display title used on cover pages, Stripe product name, email subject hooks. */
  fullName: string;
  /** Short name used in success-page copy and email subject lines. */
  shortName: string;
  /** Marketing one-liner used in checkout-page subhead + OG description. */
  blurb: string;
  /** Alt text for the OG share image on per-kit pages. */
  ogAlt: string;
  /** Path to the PDF under aipocketagency-website/public — also the filename Resend attaches. */
  pdfPath: `/${string}.pdf`;
  /** Resend delivery subject when the buyer pays. */
  deliverySubject: string;
};

export const KIT_CONFIG: Record<KitSlug, KitConfig> = {
  "dispatch-playbook": {
    slug: "dispatch-playbook",
    fullName: "The Dispatch Playbook",
    shortName: "Dispatch Playbook",
    blurb:
      "The operator manual for running parallel Claude Code agents without them stepping on each other.",
    ogAlt: "The Dispatch Playbook — $15 instant download",
    pdfPath: "/dispatch-playbook.pdf",
    deliverySubject: "Your Dispatch Playbook is here",
  },
  "dev-team-document-set": {
    slug: "dev-team-document-set",
    fullName: "The Dev-Team Document Set",
    shortName: "Dev-Team Document Set",
    blurb:
      "Eleven document templates plus three operational conventions — drop them into any repo and the agents inherit dev-team discipline on day one.",
    ogAlt: "The Dev-Team Document Set — $15 instant download",
    pdfPath: "/dev-team-document-set.pdf",
    deliverySubject: "Your Dev-Team Document Set is here",
  },
  "claude-md-template-library": {
    slug: "claude-md-template-library",
    fullName: "The CLAUDE.md Template Library",
    shortName: "CLAUDE.md Template Library",
    blurb:
      "Six opinionated CLAUDE.md templates (SaaS, contractor SaaS, marketing site, mobile app, API service, internal tool) — pick the closest, fill five slots, agent is on-rails in thirty minutes.",
    ogAlt: "CLAUDE.md Template Library — $15 instant download",
    pdfPath: "/claude-md-template-library.pdf",
    deliverySubject: "Your CLAUDE.md Template Library is here",
  },
  "discovery-to-mvp-prompt-pack": {
    slug: "discovery-to-mvp-prompt-pack",
    fullName: "Discovery → MVP Prompt Pack",
    shortName: "Discovery → MVP Prompt Pack",
    blurb:
      "The sequenced prompts I use to turn a 30-minute discovery call into shipped software in days. Eight prompts. One real case study — Patrick, end to end.",
    ogAlt: "Discovery → MVP Prompt Pack — $15 instant download",
    pdfPath: "/discovery-to-mvp-prompt-pack.pdf",
    deliverySubject: "Your Discovery → MVP Prompt Pack is here",
  },
  "wire-brain-to-stack-guide": {
    slug: "wire-brain-to-stack-guide",
    fullName: "Wire the Brain to Your Stack",
    shortName: "Wire the Brain to Your Stack",
    blurb:
      "Seven MCP walkthroughs — Drive, Gmail, Slack, Notion, Linear, GitHub, Supabase — with auth setup, working queries, real gotchas, and the brain-sync patterns operators actually run.",
    ogAlt: "Wire the Brain to Your Stack — $15 instant download",
    pdfPath: "/wire-brain-to-stack-guide.pdf",
    deliverySubject: "Your Wire-the-Brain guide is here",
  },
};

export const KIT_SLUGS = Object.keys(KIT_CONFIG) as KitSlug[];

export function isKitSlug(value: string): value is KitSlug {
  return value in KIT_CONFIG;
}

export function getKitConfig(slug: string): KitConfig | null {
  return isKitSlug(slug) ? KIT_CONFIG[slug] : null;
}
