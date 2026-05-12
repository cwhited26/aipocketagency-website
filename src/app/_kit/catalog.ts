export type KitMeta = {
  slug: string;
  shortName: string;
  fullName: string;
  blurb: string;
  ogAlt: string;
};

export const KITS: Record<string, KitMeta> = {
  "dev-team-document-set": {
    slug: "dev-team-document-set",
    shortName: "Dev-Team Document Set",
    fullName: "The Dev-Team Document Set",
    blurb:
      "Eleven document templates plus three operational conventions — drop them into any repo and the agents inherit dev-team discipline on day one.",
    ogAlt: "The Dev-Team Document Set — $15 instant download",
  },
  "claude-md-template-library": {
    slug: "claude-md-template-library",
    shortName: "CLAUDE.md Template Library",
    fullName: "The CLAUDE.md Template Library",
    blurb:
      "Six opinionated CLAUDE.md templates (SaaS, contractor SaaS, marketing site, mobile app, API service, internal tool) — pick the closest, fill five slots, agent is on-rails in thirty minutes.",
    ogAlt: "CLAUDE.md Template Library — $15 instant download",
  },
  "discovery-to-mvp-prompt-pack": {
    slug: "discovery-to-mvp-prompt-pack",
    shortName: "Discovery → MVP Prompt Pack",
    fullName: "Discovery → MVP Prompt Pack",
    blurb:
      "The sequenced prompts I use to turn a 30-minute discovery call into shipped software in days. Eight prompts. One real case study — Patrick, end to end.",
    ogAlt: "Discovery → MVP Prompt Pack — $15 instant download",
  },
  "wire-brain-to-stack-guide": {
    slug: "wire-brain-to-stack-guide",
    shortName: "Wire the Brain to Your Stack",
    fullName: "Wire the Brain to Your Stack",
    blurb:
      "Seven MCP walkthroughs — Drive, Gmail, Slack, Notion, Linear, GitHub, Supabase — with auth setup, working queries, real gotchas, and the brain-sync patterns operators actually run.",
    ogAlt: "Wire the Brain to Your Stack — $15 instant download",
  },
};

export function getKitMeta(slug: string): KitMeta {
  const meta = KITS[slug];
  if (!meta) {
    throw new Error(`Unknown kit slug: ${slug}`);
  }
  return meta;
}
