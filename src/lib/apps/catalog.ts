// catalog.ts — the single source of truth for the Apps a Pocket Agent can run. An App is
// the WHAT: a reusable workflow (draft an email, sweep for cold deals, write a quote). A
// Persona is the WHO that uses them. Both the Apps tab and the Personas surface read this
// list, so a persona's declared toolkit and the real Apps menu can never drift apart.
//
// Pure data + lookups, no I/O — safe to import from server routes and client components.

export const APP_IDS = [
  "quote",
  "email-drafter",
  "followups",
  "daily-brief",
  "upcoming",
  "youtube",
  "podcasts",
  "lead-scout",
  "follow-up-sweeps",
  "landing-page-builder",
  "capture-inbox",
  "brain-map",
] as const;

export type AppId = (typeof APP_IDS)[number];

export type AppDef = {
  id: AppId;
  href: string;
  label: string;
  // Short label used in compact chips on the persona surface.
  shortLabel: string;
  // Full description shown on the Apps tab card.
  description: string;
  // One-line blurb for the "what this persona uses" list on a persona profile.
  blurb: string;
  tag: string;
  tagColor: "cyan" | "muted";
};

export const APP_CATALOG: AppDef[] = [
  {
    id: "quote",
    href: "/app/apps/quote",
    label: "Quote / Proposal Writer",
    shortLabel: "Quotes",
    description:
      "Drop in a client name, the scope, and any specifics. Reads your brain for services, pricing, and positioning — then produces a structured draft in your voice.",
    blurb: "Turn a scope into a structured quote or proposal in your voice.",
    tag: "Output",
    tagColor: "cyan",
  },
  {
    id: "email-drafter",
    href: "/app/apps/email",
    label: "Email Drafter",
    shortLabel: "Email",
    description:
      "Tell it who you're writing to, why, and what to cover. Reads your voice from the brain and drafts an email that sounds like you wrote it.",
    blurb: "Draft an email to anyone, in your voice.",
    tag: "Output",
    tagColor: "cyan",
  },
  {
    id: "followups",
    href: "/app/apps/followups",
    label: "Follow-up Radar",
    shortLabel: "Follow-ups",
    description:
      "Scans your brain for relationships, leads, and deals that have gone cold. Surfaces the gap and drafts the nudge for each one.",
    blurb: "Spot deals going cold and draft the nudge for each.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "daily-brief",
    href: "/app/apps/daily-brief",
    label: "Daily Brief",
    shortLabel: "Daily Brief",
    description:
      "Your morning read. The agent scans your brain and writes what's on the radar, what's pending, and the one thing to move on today.",
    blurb: "A morning read of what's pending and the one thing to move on.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "upcoming",
    href: "/app/apps/calendar",
    label: "Upcoming (from brain)",
    shortLabel: "Upcoming",
    description:
      "Scans your brain for anything date or deadline related — scheduled jobs, deadlines, follow-up timelines. For live events, see Calendar in the sidebar.",
    blurb: "Surface dates and deadlines hiding in your brain.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "youtube",
    href: "/app/apps/youtube",
    label: "YouTube",
    shortLabel: "YouTube",
    description:
      "Drop a YouTube link — PA reads the video, files what matters in your brain by use case, and watches channels so you catch every new upload.",
    blurb: "Read a video and file what matters in your brain.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "podcasts",
    href: "/app/apps/podcasts",
    label: "Podcast Ingester",
    shortLabel: "Podcasts",
    description:
      "Drop a podcast link — PA listens to the episode, pulls out what matters by use case (a competitor's claim, a pricing tactic, a customer quote), and files a clean note in your brain so you don't sit through 90 minutes of audio.",
    blurb: "Pull what matters out of an episode without the 90-minute listen.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "lead-scout",
    href: "/app/apps/lead-scout",
    label: "Lead Scout",
    shortLabel: "Lead Scout",
    description:
      "New: subscribe to a vertical pack and PA runs the full sweep + outreach loop for you — roofing, HVAC, painting, med spa, law firm, and more, each pre-tuned. Or build your own: sweep Google Maps for a category in a place (roofers near Knoxville without a website) or paste your own URLs. Either way PA sorts them by fit and drafts a first email in your voice for Approve & Send.",
    blurb: "Find businesses that fit and draft the first outreach.",
    tag: "Finds Leads",
    tagColor: "cyan",
  },
  {
    id: "follow-up-sweeps",
    href: "/app/apps/follow-up-sweeps",
    label: "Follow-Up Sweeps",
    shortLabel: "Follow-Up Sweeps",
    description:
      "Closes the loop on every conversation you started and didn't finish. Watches the contacts that have gone quiet — leads who ghosted, customers you haven't checked in on, past clients worth winning back — across your Gmail, your brain's customer files, and your Lead Scout leads. Each week it drafts the next touch in your voice and stages the batch in Mission Control for one tap. Mark anyone \"leave alone\" and it stays off the list.",
    blurb: "Watch contacts that go quiet and draft the next touch each week.",
    tag: "Runs Weekly",
    tagColor: "cyan",
  },
  {
    id: "landing-page-builder",
    href: "/app/apps/landing-pages",
    label: "Landing Page Builder",
    shortLabel: "Landing Pages",
    description:
      "Describe the page you need — a page for your roofing business with a hero, the problem you solve, how it works, and one clear ask. PA writes the copy in your voice, builds the page on your own GitHub and Vercel, and stages each step for your approval. You get a live link, and the code is yours.",
    blurb: "Describe a landing page; PA builds it on your accounts and hands you a live link.",
    tag: "Builds",
    tagColor: "cyan",
  },
  {
    id: "capture-inbox",
    href: "/app/settings/capture-routing",
    label: "Capture Inbox",
    shortLabel: "Capture Inbox",
    description:
      "Everything you tap, talk, or share into your brain lands here first. Set rules so the obvious stuff files itself — a competitor's link goes straight to your competitor notes. Each Monday, PA reads what's left, suggests where each one belongs, and you approve with a tap. Once something's filed in your brain, it clears out of the inbox so the list stays short.",
    blurb: "File what you capture: rules that route it, a weekly sweep that sorts the rest.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    id: "brain-map",
    href: "/app/brain-map",
    label: "Brain Map",
    shortLabel: "Brain Map",
    description:
      "See what PA knows about your business — interactive map of every fact, voice cue, decision, and customer it's learned.",
    blurb: "See what the agent knows about your business.",
    tag: "View",
    tagColor: "muted",
  },
];

const BY_ID = new Map<string, AppDef>(APP_CATALOG.map((a) => [a.id, a]));

export function getApp(id: string): AppDef | null {
  return BY_ID.get(id) ?? null;
}

export function isAppId(id: string): id is AppId {
  return BY_ID.has(id);
}

/** Resolves a list of stored app ids to their definitions, dropping any unknown ids and
 *  preserving catalog order so the display is stable regardless of stored order. */
export function appsByIds(ids: readonly string[]): AppDef[] {
  const wanted = new Set(ids);
  return APP_CATALOG.filter((a) => wanted.has(a.id));
}

/** Keeps only the ids that exist in the catalog (de-duplicated). Used to sanitize any
 *  caller-supplied app selection before it is persisted. */
export function sanitizeAppIds(ids: readonly string[]): AppId[] {
  const out: AppId[] = [];
  for (const a of APP_CATALOG) {
    if (ids.includes(a.id)) out.push(a.id);
  }
  return out;
}
