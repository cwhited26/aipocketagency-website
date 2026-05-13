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

/**
 * Per-kit marketing content rendered by `KitLandingPage` beneath the hero
 * + form block. Optional — kits without a populated `marketingContent` get
 * the bare hero + form treatment.
 */
export type KitMarketingContent = {
  /** One-line hook displayed beneath the hero headline. */
  heroSubhead: string;
  /** "[ kit · …" pill label rendered in monospace above the hero headline. */
  heroPill: string;
  /** Section heading on the problem block. */
  problemHeadline: string;
  /** 2–3 short paragraphs of problem context. */
  problemParagraphs: string[];
  /** Section heading on the value-prop block. */
  whatsInsideHeadline: string;
  /** One-paragraph intro above the bulleted/numbered list. */
  whatsInsideIntro: string;
  /** Numbered value-prop items rendered as a list. */
  whatsInsideItems: { n: number; title: string }[];
  /** One-paragraph outro beneath the list. */
  whatsInsideOutro: string;
  /** Section heading on the close block above the form. */
  dealHeadline: string;
  /** 1–2 short paragraphs supporting the close. */
  dealParagraphs: string[];
};

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
  /**
   * The kit Stripe should bundle into this checkout at +$10 if the buyer
   * accepts the order bump. Russell-Brunson order-bump pairings — natural
   * adjacencies that compound (Dispatch → Dev-Team artifacts, etc.).
   */
  bumpTarget: KitSlug;
  /**
   * Long-form marketing content rendered by `KitLandingPage`. Kits that
   * leave this undefined render a bare hero + form treatment.
   */
  marketingContent?: KitMarketingContent;
  /**
   * Set to `true` ONLY when a clean per-kit hero PNG is sitting at
   * `public/funnel-images/<slug>-hero.png`. When `false` the hero image
   * is skipped entirely (page renders hero text + form, no broken-image
   * box). Default to `false` for any new kit until art is verified.
   *
   * Background: 2026-05-12 audit caught all 5 then-shipped per-kit hero
   * PNGs had a baked-in agent caption ("Premium PDF mockup · dark-mode
   * launch asset") that leaked as visible artwork. The corrupt PNGs were
   * deleted; this flag lets a kit re-enable its hero one-by-one as Chase
   * delivers clean replacements.
   */
  heroAvailable: boolean;
};

/**
 * Full bundle (all 5 kits) anchor + offer pricing. Locked in APA Decision Log
 * 2026-05-11 (Russell-style funnel — anchor $97, offer $47, delta computed
 * against what the buyer already paid for kit + optional bump).
 */
export const BUNDLE_PRICING = {
  anchorUsd: 97,
  offerUsd: 47,
} as const;

/**
 * Single-kit retail (before any bump or bundle). Locked at unified $15 launch
 * tier per Digital_Products_Catalog.md.
 */
export const KIT_RETAIL_USD = 15;

/**
 * Public bundle price — shown on `/bundle` and on every kit landing's bundle
 * CTA. Distinct from `BUNDLE_PRICING.offerUsd` ($47), which only surfaces
 * inside the post-lead funnel interstitial at `/<kit>/upgrade-bundle/<lead>`
 * — that price stays funnel-only ("this price isn't shown anywhere else on
 * the site"). The public $60 anchor preserves the $47 structural scarcity
 * while still naming a concrete saving against the $75 sum-of-parts.
 */
export const BUNDLE_PUBLIC_USD = 60;

/**
 * Order-bump price (+$10 over the $15 retail when added at checkout).
 * The Stripe price ID with this unit_amount is created per kit alongside the
 * standard $15 price, marked with `metadata.bump_price = 'true'` and the same
 * `kit_slug` metadata for lookup.
 */
export const BUMP_USD = 10;

/** Skool community offer — locked anchor + founding-50 rate per APA decision log. */
export const SKOOL_PRICING = {
  anchorUsd: 97,
  offerUsd: 47,
  foundingSpots: 50,
  /**
   * Founding-50 spots remaining display value. Hard-coded here so the page
   * doesn't have to hit the Skool API. Update by hand as members join.
   */
  spotsRemaining: 50,
} as const;

export const KIT_CONFIG: Record<KitSlug, KitConfig> = {
  "dispatch-playbook": {
    slug: "dispatch-playbook",
    fullName: "The Dispatch Playbook",
    shortName: "Dispatch Playbook",
    blurb:
      "The field manual for running parallel Claude Code agents without them stepping on each other.",
    ogAlt: "The Dispatch Playbook — $15 instant download",
    pdfPath: "/dispatch-playbook.pdf",
    deliverySubject: "Your Dispatch Playbook is here",
    bumpTarget: "dev-team-document-set",
    heroAvailable: true,
    marketingContent: {
      heroPill: "[ $15 · instant download ]",
      heroSubhead: "Stop being scared to spawn parallel agents.",
      problemHeadline: "Most builders using Claude Code never touch Dispatch.",
      problemParagraphs: [
        "They've heard about it. They know parallel lanes would let them ship 4 things at once instead of waiting on one chat. But the fear is real — agents stepping on each other, branches diverging, half-finished pushes, code they didn't write going to main.",
        "So they stay single-threaded. Watch one agent work. Hit “allow” every 5 minutes. Wait.",
      ],
      whatsInsideHeadline: "The field manual I should have had.",
      whatsInsideIntro:
        "The Dispatch Playbook is the field manual I should have had when I started running parallel agents. Eleven sections covering:",
      whatsInsideItems: [
        { n: 1, title: "Why Dispatch matters (vs single-thread Claude Code)" },
        { n: 2, title: "The “rogue agent” fear and why it’s solvable" },
        { n: 3, title: "The 3-tier task model: cowork vs code vs main thread" },
        {
          n: 4,
          title:
            "Worktree-based parallel lane pattern (agents don’t step on each other)",
        },
        {
          n: 5,
          title:
            "Standing rules every lane needs (rebase, verify push, self-cleanup)",
        },
        {
          n: 6,
          title:
            "How to write a clean lane prompt (verbatim copy, success criteria, blockers)",
        },
        {
          n: 7,
          title:
            "Verification discipline (lane-report vs disk vs remote vs behavior-verified)",
        },
        {
          n: 8,
          title:
            "Parallel orchestration patterns (sequential, fan-out, watch-and-merge)",
        },
        {
          n: 9,
          title:
            "Common failure modes (duplicate lanes, stale branches, push conflicts, FUSE EPERM, dispatch timeouts)",
        },
        {
          n: 10,
          title:
            "Real example walkthroughs (Patrick / APA / TVE — client specifics scrubbed)",
        },
        { n: 11, title: "What to do when it goes wrong (abort, rollback, recover)" },
      ],
      whatsInsideOutro:
        "PDF bundle, written in plain voice. No theory. No filler. Just the rules I run my own multi-agent setup on.",
      dealHeadline:
        "$15. Instant download.",
      dealParagraphs: [
        "$15. Instant download. The moment Stripe confirms payment, the PDF bundle lands in your inbox. No wait, no queue. You bought it, you have it.",
      ],
    },
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
    bumpTarget: "claude-md-template-library",
    heroAvailable: true,
    marketingContent: {
      heroPill: "[ $15 · 11 templates + 3 conventions ]",
      heroSubhead:
        "Stop letting agents reinvent the same decisions every session.",
      problemHeadline:
        "Solo operators ship slop because there's no one in the repo to keep them honest.",
      problemParagraphs: [
        "Your repo has no decision log. No changelog. No ADRs. No conventions doc. So the agents reinvent the same decisions every session — and contradict the ones they made last week.",
        "You notice it three weeks in. The codebase has six ways to fetch data. Two auth flows. A README that hasn't matched reality since the first commit. The agent isn't broken — it's just reading a repo that never told it what to do.",
        "Competitors on the AI-workflow scene sell exactly this artifact set for $497+. Same templates. Same conventions. Same scripts. They charge $497 because operators pay $497 for this — that's the wall.",
      ],
      whatsInsideHeadline:
        "Eleven templates. Three conventions. Two scripts that keep the rest honest.",
      whatsInsideIntro:
        "The Dev-Team Document Set is what a five-person dev team would drop into your repo if you actually had one. Same artifacts I run in whited-brain and across every client build. Drop them in, fill the slots, and the agents have something to read instead of guess.",
      whatsInsideItems: [
        {
          n: 1,
          title:
            "CLAUDE.md template — project context, stack, agent rules, what to read first, what to never touch",
        },
        {
          n: 2,
          title:
            "AGENTS.md template — assistant role, startup behavior, safety rules, multi-agent coordination",
        },
        {
          n: 3,
          title:
            "MEMORY.md scaffold — the 4-type pattern (user / feedback / project / reference) with worked entries",
        },
        {
          n: 4,
          title:
            "Decision Log template + 3 worked entries (date, decision, alternatives, rationale, dependencies)",
        },
        {
          n: 5,
          title:
            "Change Log template + 3 worked entries (entry format, what counts, who/when/why discipline)",
        },
        {
          n: 6,
          title:
            "Feature Inventory template — feature-by-feature with status, owner, dependencies",
        },
        {
          n: 7,
          title:
            "Coding Conventions doc — no `any`, no `console.log`, no silent catches, additive-only migrations, direct `fetch` over SDKs",
        },
        {
          n: 8,
          title:
            "Security Gates checklist — env vars, 1Password pattern, RLS audit, secret-leak red flags",
        },
        {
          n: 9,
          title:
            "Deployment Checklist — pre-deploy, deploy, post-deploy verification (migrations applied, edge functions redeployed, smoke test)",
        },
        {
          n: 10,
          title:
            "ADR template + 2 worked ADRs (context, decision, consequences, status: proposed / accepted / superseded)",
        },
        {
          n: 11,
          title:
            "README template — what the repo is, what it isn't, how agents should read it, where the brain lives",
        },
        {
          n: 12,
          title:
            "Supersession convention — never delete a decision; mark superseded and link forward. The brain becomes an evolution record, not a whiteboard.",
        },
        {
          n: 13,
          title:
            "Cascade Staleness convention + `stale-audit.sh` — `Depends on:` field plus a 50-line bash script that walks the dependency graph when an upstream changes",
        },
        {
          n: 14,
          title:
            "Lane Current_State convention + `lane-summary.sh` — auto-rolled per-lane summary; a new agent reads one file and has 80% of the context",
        },
      ],
      whatsInsideOutro:
        "Zip bundle. Markdown templates and bash scripts. The two audit scripts are the part competitors don't ship — most template kits go stale because nothing surfaces when they do. These ones tell you out loud.",
      dealHeadline:
        "$15. Instant download. Competitors charge $497 for the same artifact set.",
      dealParagraphs: [
        "$15. Instant download. The zip lands in your inbox the moment Stripe confirms — same artifacts I run in whited-brain and across every client repo.",
        "If it doesn't kill the convention drift in your repo inside a weekend, reply to the receipt and I'll refund it. No form, no question.",
      ],
    },
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
    bumpTarget: "wire-brain-to-stack-guide",
    heroAvailable: true,
    marketingContent: {
      heroPill: "[ $15 · 6 templates ]",
      heroSubhead:
        "Pick the closest, fill five slots, agent is on-rails before lunch.",
      problemHeadline:
        "Every new project starts with eight hours of writing context that should already exist.",
      problemParagraphs: [
        "You open a fresh repo, fire up Claude Code, and the agent has no idea which Postgres library you use. Which auth provider. Which deploy command. Which files it should never touch.",
        "So you spend the first morning typing the same boilerplate you've typed for the last four projects. By the time the CLAUDE.md is half-decent, it's lunch — and the agent still hasn't shipped a feature.",
        "The fix isn't typing faster. The fix is starting from a template that already knows what stack you're on.",
      ],
      whatsInsideHeadline:
        "Six CLAUDE.md templates — pick the one that fits the stack.",
      whatsInsideIntro:
        "Six opinionated CLAUDE.md templates, each calibrated for a specific project type. Pick the closest. Fill five slots — project name, audience, deploy command, what to never touch, what to read first. Ship.",
      whatsInsideItems: [
        {
          n: 1,
          title:
            "SaaS app — Next.js + Supabase + Stripe + Vercel. Multi-tenant patterns, RLS audit rules, Stripe webhook conventions, env var inventory.",
        },
        {
          n: 2,
          title:
            "Contractor SaaS — leads → jobs → quotes → invoicing pipeline. Stripe Connect for contractor payouts, mobile-first field ops, the contractor-os-template pattern.",
        },
        {
          n: 3,
          title:
            "Marketing site — Next.js + Sanity or MDX. Content model, OG / schema markup, sitemap, analytics wiring, no-auth gotchas.",
        },
        {
          n: 4,
          title:
            "Mobile app — React Native + Expo. iOS-first build, Apple Dev account, OTA updates, App Store submission checklist, the iOS-vs-web-vs-PWA decision tree.",
        },
        {
          n: 5,
          title:
            "API service — Node + Fastify or Hono. Zod schemas, OpenAPI generation, rate limits, error response standards, auth middleware patterns.",
        },
        {
          n: 6,
          title:
            "Internal tool — Next.js admin dashboard. Single-user or small-team, magic-link auth, simpler stack defaults, the wc-admin pattern.",
        },
      ],
      whatsInsideOutro:
        "Each template ships with eight sections: project context, stack overview with rationale, code conventions, agent rules, gotchas (the 3–5 things that trip new operators on this stack), deploy commands, what to read first, what to never touch. Zip bundle, ready to drop into a fresh repo.",
      dealHeadline:
        "$15. Instant download. Six templates — use one today, grow into the rest.",
      dealParagraphs: [
        "$15. Instant download. The zip lands in your inbox the moment Stripe confirms — six markdown templates plus the 8-page companion guide on how to pick, fill, and extend.",
        "If the template you pick doesn't get the agent on-rails by the time you finish filling the five slots, reply and I'll refund it. No form, no question.",
      ],
    },
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
    bumpTarget: "dispatch-playbook",
    heroAvailable: true,
    marketingContent: {
      heroPill: "[ $15 · 8 prompts + Patrick case study ]",
      heroSubhead:
        "Discovery call Monday. Working MVP by Friday. Same prompts, every time.",
      problemHeadline:
        "Discovery call to working software is where most operators stall.",
      problemParagraphs: [
        "You took the notes. You have a transcript. You have a sense of what the buyer wants. Then you sit down to build and realize you don't have a spec — you have impressions. Three sessions in, the agent is shipping things you didn't ask for and missing things you did.",
        "Patrick was different. Discovery call on Monday. Working roof-inspection software live the following Friday. $3,500 build, monthly hosting, signed handoff. Same agent everyone else uses.",
        "The difference is what got handed to the agent between the call and the first build prompt. That's what this pack is — the prompts that did the handing.",
      ],
      whatsInsideHeadline:
        "Eight sequenced prompts and the case study they shipped.",
      whatsInsideIntro:
        "Eight prompts in order, each one fed by the output of the last. Run them on a real discovery transcript and you walk out with a spec, a feature list, dispatch-ready build prompts, branding extracted from the client's existing site, and a handoff doc. The Patrick case study is the proof — every prompt run end to end, real outputs, real result.",
      whatsInsideItems: [
        {
          n: 1,
          title:
            "The Discovery Call Framework — 9 questions to ask in a 30-minute call, the feature-parking-lot technique, red flags that mean this isn't a build (it's a rescue), opening / closing scripts",
        },
        {
          n: 2,
          title:
            "Transcript → Spec prompt — paste the transcript + one paragraph of framing, get a structured spec: problem, audience, MVP feature set, post-MVP backlog, open questions",
        },
        {
          n: 3,
          title:
            "Spec → Feature-List prompt — break the spec into shippable features ranked by leverage (impact × buildability), with dependencies and estimated dispatch lanes",
        },
        {
          n: 4,
          title:
            "Feature → Build-Prompts sequence — each feature becomes a dispatch lane prompt with verbatim success criteria, blockers, and verification rules",
        },
        {
          n: 5,
          title:
            "Branding Extraction prompt — pull logo, colors, type, and copy tone from the client's existing site; generate Tailwind config + brand tokens. Plus the no-brand-yet path (defaults + 3 options the client picks from)",
        },
        {
          n: 6,
          title:
            "Migration Path prompt — for clients with existing CSVs, sheets, or current-SaaS exports. Generates extract → transform → load + reconciliation checklist",
        },
        {
          n: 7,
          title:
            "Handoff Doc prompt — generates the 60-day support handoff (how to log in, make changes, add users, read analytics, who to call when X breaks)",
        },
        {
          n: 8,
          title:
            "Patrick Fresh Page Home Improvement — the full case study. Transcript → MVP arc, every prompt with the actual output, annotated with what worked and what I'd do differently next time",
        },
      ],
      whatsInsideOutro:
        "PDF + markdown prompt files + the annotated case study. The prompts are the sequence. Patrick is the proof that the sequence works against a real client, real dollars, real signed handoff.",
      dealHeadline:
        "$15. Instant download. Close one $3,500 build and the pack paid back 230×.",
      dealParagraphs: [
        "$15. Instant download. The prompts hit your inbox the moment Stripe confirms — eight markdown files, the PDF guide, the Patrick case study end to end.",
        "If the sequence doesn't get you from a real discovery transcript to a real working build, reply and I'll refund it. No form, no question.",
      ],
    },
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
    bumpTarget: "discovery-to-mvp-prompt-pack",
    heroAvailable: true,
    marketingContent: {
      heroPill: "[ $15 · 7 MCP walkthroughs ]",
      heroSubhead:
        "Drive, Gmail, Slack, Notion, Linear, GitHub, Supabase — wired in, gotchas named, working queries you can copy and run.",
      problemHeadline:
        "The brain works alone. It multiplies when you wire it to the tools you actually use.",
      problemParagraphs: [
        "Most people with a brain set up never wire it to anything. The docs are scattered. The OAuth flows are confusing. Every connection has three scope decisions that read identical until one of them locks you out at runtime.",
        "So the brain sits there — useful for context, useless for action. The Gmail thread the buyer cited stays buried. The Drive folder with the spec stays unread. The Linear ticket gets opened by hand. Every time.",
        "The unlock isn't a smarter brain. The unlock is wiring it to the seven places your work already lives.",
      ],
      whatsInsideHeadline:
        "Seven walkthroughs. Same shape every time.",
      whatsInsideIntro:
        "Each walkthrough covers four things: the auth flow with the exact scopes you actually need, three working example queries you can copy and run, three gotchas that trip people on their first wire-up, and one sync pattern that turns the connection into a brain multiplier instead of a read-only lookup.",
      whatsInsideItems: [
        {
          n: 1,
          title:
            "Drive MCP — OAuth + Google Cloud project setup, `drive.readonly` + `drive.metadata` scopes, the shared-drive vs my-drive trap, sync pattern: Drive changelog → brain Decision Log entry",
        },
        {
          n: 2,
          title:
            "Gmail MCP — OAuth, `gmail.readonly` + `gmail.modify` scopes, the message-vs-thread ID gotcha, sync pattern: Gmail label → brain task entry",
        },
        {
          n: 3,
          title:
            "Slack MCP — workspace OAuth, bot-vs-user token decision, private-channel access trap, sync pattern: decision message → brain Decision Log with link back to the thread",
        },
        {
          n: 4,
          title:
            "Notion MCP — integration token + per-page invites, block-vs-page model trap, sync pattern: brain changelog → Notion database",
        },
        {
          n: 5,
          title:
            "Linear MCP — API key vs OAuth, team-vs-project scope, label conventions, sync pattern: Linear ticket → brain task; brain task closure → Linear issue close",
        },
        {
          n: 6,
          title:
            "GitHub MCP — PAT vs GitHub App OAuth (when to use which), the install-per-repo gotcha, sync pattern: commits + PR descriptions → brain Change Log entries",
        },
        {
          n: 7,
          title:
            "Supabase MCP — access token + project scope, RLS-aware query patterns, service-role-vs-anon-key gotcha, sync pattern: schema → brain Feature Inventory sync",
        },
      ],
      whatsInsideOutro:
        "PDF guide + 7 markdown walkthroughs + a sanitized screenshot library from the auth flows I actually ran. Every screenshot is from a real setup. Every gotcha is one I hit before I wrote it down.",
      dealHeadline:
        "$15. Instant download. Wire two integrations this weekend, the other five over the year.",
      dealParagraphs: [
        "$15. Instant download. PDF + 7 markdown files + screenshot library — the lot lands in your inbox the moment Stripe confirms.",
        "If you wire one MCP from this guide and it doesn't return a working query against your real data, reply and I'll refund it. No form, no question.",
      ],
    },
  },
};

export const KIT_SLUGS = Object.keys(KIT_CONFIG) as KitSlug[];

export function isKitSlug(value: string): value is KitSlug {
  return value in KIT_CONFIG;
}

export function getKitConfig(slug: string): KitConfig | null {
  return isKitSlug(slug) ? KIT_CONFIG[slug] : null;
}
