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
  "idea-engine",
  "brain-map",
  "workflow-vault",
  "ritual-scheduler",
  "competitor-inspector",
  "website-monitor",
  "proposal-generator",
  "browser-agent",
  "channels",
  "sms-channel",
  "imessage-channel",
  "whatsapp-channel",
] as const;

export type AppId = (typeof APP_IDS)[number];

export type AppDef = {
  id: AppId;
  href: string;
  // The `/`-command token that opens this App from the chat surface (PA-SLASH-1). Matches the
  // App's slug so the two never drift; the slash dispatcher (lib/apps/slash-commands.ts) resolves
  // `/<slashCommand>` (plus a few forgiving aliases) to this App and opens it pre-filled.
  slashCommand: string;
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
    slashCommand: "quote",
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
    slashCommand: "email-drafter",
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
    slashCommand: "followups",
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
    slashCommand: "daily-brief",
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
    slashCommand: "upcoming",
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
    slashCommand: "youtube",
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
    slashCommand: "podcasts",
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
    slashCommand: "lead-scout",
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
    id: "competitor-inspector",
    slashCommand: "competitor-inspector",
    href: "/app/apps/competitor-inspector",
    label: "Competitor Inspector",
    shortLabel: "Competitor Inspector",
    description:
      "Paste a competitor's web address and PA reads their site the way a designer would — colors, type, layout, what moves and when — and writes a structured profile into your brain. You see what they sell and how the page sells it, what's worth borrowing, and what to skip. You approve before anything lands. No copying: PA records the style, never their words or images.",
    blurb: "Read a rival's site and file a style-and-offer profile in your brain.",
    tag: "Research",
    tagColor: "cyan",
  },
  {
    id: "follow-up-sweeps",
    slashCommand: "follow-up-sweeps",
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
    slashCommand: "landing-page-builder",
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
    id: "idea-engine",
    slashCommand: "idea-engine",
    href: "/app/apps/idea-engine",
    label: "Idea Engine",
    shortLabel: "Idea Engine",
    description:
      "You have brilliant ideas. They keep dying in a notes app. Drop one — typed, a voice memo, or a link you were watching — and PA runs the chain: scans the market, writes the MVP plan for you to approve, then ships the MVP on your own GitHub and Vercel. It ends with a working link and your first 25 outreach drafts, not one more prompt box.",
    blurb: "Drop an idea. Approve the plan. PA ships the MVP on your accounts.",
    tag: "Builds",
    tagColor: "cyan",
  },
  {
    id: "brain-map",
    slashCommand: "brain-map",
    href: "/app/brain-map",
    label: "Brain Map",
    shortLabel: "Brain Map",
    description:
      "See what PA knows about your business — interactive map of every fact, voice cue, decision, and customer it's learned.",
    blurb: "See what the agent knows about your business.",
    tag: "View",
    tagColor: "muted",
  },
  {
    id: "ritual-scheduler",
    slashCommand: "ritual-scheduler",
    href: "/app/apps/rituals",
    label: "Ritual Scheduler",
    shortLabel: "Rituals",
    description:
      "You keep meaning to run the same thing every week and it slips. Tell PA once — \"every Monday at 8, review my open leads\" — and it runs on that schedule for good. Pick which App fires, type the schedule in plain words (no cron, ever), and the result is waiting in Mission Control when you sit down. Pause, edit, or delete it from one place. Starts with 8 ready rituals you install in a tap.",
    blurb: "Author a recurring job once; the result is waiting when you sit down.",
    tag: "Runs On Schedule",
    tagColor: "cyan",
  },
  {
    id: "workflow-vault",
    slashCommand: "workflow-vault",
    href: "/app/apps/workflow-vault",
    label: "AI Workflow Vault",
    shortLabel: "Workflow Vault",
    description:
      "25 ready-to-run workflows you install with one tap — quote follow-ups, dormant-lead sweeps, a morning brief, content repurposing, lead research, and more. Pick one, choose which Persona runs it, and it's working. Your plan unlocks a set of them; the Workflow Vault add-on opens all 25.",
    blurb: "Install ready-made workflows with one tap and put a Persona on each.",
    tag: "Runs Workflows",
    tagColor: "cyan",
  },
  {
    id: "website-monitor",
    slashCommand: "website-monitor",
    href: "/app/apps/website-monitor",
    label: "Website Monitoring",
    shortLabel: "Monitoring",
    description:
      "Add the URLs that matter — your site, your checkout, a client's landing page — and PA checks them on a schedule. When one goes down, slows to a crawl, changes, or its SSL certificate is about to lapse, the alert is waiting in Mission Control. Set the frequency and which changes you care about per URL.",
    blurb: "Watch your sites; get an alert the moment one goes down or slows.",
    tag: "Always Watching",
    tagColor: "cyan",
  },
  {
    id: "proposal-generator",
    slashCommand: "proposal-generator",
    href: "/app/apps/proposals",
    label: "Proposal Generator",
    shortLabel: "Proposals",
    description:
      "Pick a Persona, drop in the client and the scope, and PA drafts a full proposal in their voice — cover summary, the problems you're solving, deliverables, timeline, investment, success criteria, next steps, signatures. Edit it, then send it as a Gmail draft with the PDF attached or file it to your brain.",
    blurb: "Turn a brief into a full, on-voice client proposal — markdown + PDF.",
    tag: "Output",
    tagColor: "cyan",
  },
  {
    id: "browser-agent",
    slashCommand: "browser-agent",
    href: "/app/apps/browser",
    label: "Browser Agent",
    shortLabel: "Browser",
    description:
      "The agent that operates tools without APIs — sites you'd otherwise have to click through yourself. Screenshots + approvals on every step.",
    blurb: "Operate the sites that have no API — with a screenshot record of every step.",
    tag: "Operates Tools",
    tagColor: "cyan",
  },
  {
    id: "channels",
    slashCommand: "channels",
    href: "/app/connections/slack",
    label: "Channels",
    shortLabel: "Channels",
    description:
      "Message your agent from Slack — same agent, same memory, same approvals. Connect it once and your agent answers where your team already talks; anything that needs your sign-off still waits for you in Mission Control.",
    blurb: "Reach your agent from Slack, like messaging a teammate.",
    tag: "Wherever You Work",
    tagColor: "cyan",
  },
  {
    id: "sms-channel",
    slashCommand: "sms-channel",
    href: "/app/settings/connections",
    label: "Text Your Agent (SMS)",
    shortLabel: "SMS",
    description:
      "Text your agent from your phone — same agent, same memory, same approvals. Send a note or a photo and it answers by text; when it drafts something, reply APPROVE to send it, EDIT to change it, or REJECT to cancel.",
    blurb: "Text your agent from any phone; approve drafts by texting back.",
    tag: "Wherever You Work",
    tagColor: "cyan",
  },
  {
    id: "imessage-channel",
    slashCommand: "imessage-channel",
    href: "/app/settings/connections",
    label: "iMessage",
    shortLabel: "iMessage",
    description:
      "Message your agent in iMessage through your own Mac running BlueBubbles — the blue-bubble thread that answers back. Same approvals: reply APPROVE, EDIT, or REJECT when it drafts something for you.",
    blurb: "Your agent in your iMessage thread, relayed by your own Mac.",
    tag: "Wherever You Work",
    tagColor: "cyan",
  },
  {
    id: "whatsapp-channel",
    slashCommand: "whatsapp-channel",
    href: "/app/settings/connections",
    label: "WhatsApp",
    shortLabel: "WhatsApp",
    description:
      "Message your agent on WhatsApp through your Business number — same agent, same memory, same approvals. When it drafts something, tap Approve & send, Edit, or Reject right in the chat.",
    blurb: "Your agent on WhatsApp, with tap-to-approve drafts.",
    tag: "Wherever You Work",
    tagColor: "cyan",
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
