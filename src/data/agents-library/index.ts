// The Agents Library registry (PA-POS-24) — the static source of truth for /agents and the
// "ready-to-use agents" rails on /use-cases/*. Every agent here is a real combination of a
// shipped Persona template + Apps from src/lib/apps/catalog.ts + starter Skills from
// src/data/starter-skills/manifest.ts. Workflow lines describe what the product actually
// does, review-first (drafted → staged → you approve) — never a capability we haven't built.
//
// Pure data + lookups, no I/O — safe to import from server pages and client components.
import type { AppId } from "@/lib/apps/catalog";

export type UseCaseFilter =
  | "lead-generation"
  | "sales-outreach"
  | "content-creation"
  | "research"
  | "operations"
  | "support"
  | "idea-to-mvp";

export type IndustryFilter =
  | "coaches"
  | "consultants"
  | "contractors"
  | "med-spas"
  | "agencies"
  | "sales-teams"
  | "home-services"
  | "wellness"
  | "real-estate";

// The internal pricing-ladder rung the agent needs (matches src/lib/personas/tier-caps.ts
// gates). Chips display the name the buyer sees on /pricing, never the internal id.
export type LibraryTier = "starter" | "pro" | "pro_plus" | "studio" | "studio_plus";

export const LIBRARY_TIER_LABEL: Record<LibraryTier, string> = {
  starter: "Personal Brain",
  pro: "Business Agent",
  pro_plus: "Pro+",
  studio: "Studio",
  studio_plus: "AI Agent Workspace",
};

export type IntegrationSlug =
  | "gmail"
  | "google-maps"
  | "google-calendar"
  | "linkedin"
  | "hubspot"
  | "github"
  | "vercel"
  | "supabase"
  | "quickbooks"
  | "youtube"
  | "podcasts"
  | "web"
  | "firecrawl"
  | "business-brain";

export const INTEGRATIONS: Record<IntegrationSlug, { label: string; src: string }> = {
  gmail: { label: "Gmail", src: "/logos/integrations/gmail.svg" },
  "google-maps": { label: "Google Maps", src: "/logos/integrations/google-maps.svg" },
  "google-calendar": { label: "Google Calendar", src: "/logos/integrations/google-calendar.svg" },
  linkedin: { label: "LinkedIn", src: "/logos/integrations/linkedin.svg" },
  hubspot: { label: "HubSpot", src: "/logos/integrations/hubspot.svg" },
  github: { label: "GitHub", src: "/logos/integrations/github.svg" },
  vercel: { label: "Vercel", src: "/logos/integrations/vercel.svg" },
  supabase: { label: "Supabase", src: "/logos/integrations/supabase.svg" },
  quickbooks: { label: "QuickBooks", src: "/logos/integrations/quickbooks.svg" },
  youtube: { label: "YouTube", src: "/logos/integrations/youtube.svg" },
  podcasts: { label: "Podcasts", src: "/logos/integrations/podcasts.svg" },
  web: { label: "The web", src: "/logos/integrations/web.svg" },
  firecrawl: { label: "Firecrawl", src: "/logos/integrations/firecrawl.svg" },
  "business-brain": { label: "Business Brain", src: "/logos/integrations/business-brain.svg" },
};

export type LibraryAgent = {
  slug: string;
  /** 3–5 word agent name — "Follow-Up Sweep Runner". */
  name: string;
  /** The shipped Apps this agent runs (validated against the App catalog in tests). */
  appIds: AppId[];
  useCases: UseCaseFilter[];
  /** Empty array = fits every industry; the filter shows it under all nine chips. */
  industries: IndustryFilter[];
  tier: LibraryTier;
  /** 3–5 concrete verb+noun steps, review-first. What the product does, not marketing copy. */
  workflow: string[];
  integrations: IntegrationSlug[];
  /** A realistic one-line completion message the agent produced. Composite names only. */
  completion: string;
};

export const AGENTS_LIBRARY: LibraryAgent[] = [
  // ————— Lead generation + sales outreach —————
  {
    slug: "lead-scout-contractors",
    name: "Lead Scout — Contractors",
    appIds: ["lead-scout", "email-drafter"],
    useCases: ["lead-generation", "sales-outreach"],
    industries: ["contractors", "home-services"],
    tier: "studio_plus",
    workflow: [
      "Sweep Google Maps for roofing, HVAC, and painting companies in your service area",
      "Score each business by fit — no website, thin reviews, no booking link",
      "Draft a first-touch email in your voice for every match",
      "Stage the batch in your Approval Inbox — nothing sends without you",
    ],
    integrations: ["google-maps", "gmail", "business-brain"],
    completion: "Found 18 contractors near Knoxville without a website. 18 first-touch drafts staged for your review.",
  },
  {
    slug: "lead-scout-med-spas",
    name: "Lead Scout — Med Spas",
    appIds: ["lead-scout", "email-drafter"],
    useCases: ["lead-generation", "sales-outreach"],
    industries: ["med-spas", "wellness"],
    tier: "studio_plus",
    workflow: [
      "Sweep Google Maps for med spas and aesthetics clinics in the cities you pick",
      "Sort matches by fit against the ideal client you described",
      "Draft a personalized opener for each one, anchored to what their listing is missing",
      "Stage every draft for your approval before anything goes out",
    ],
    integrations: ["google-maps", "gmail", "business-brain"],
    completion: "Swept 4 cities, scored 31 med spas, staged 12 openers worth sending. Waiting on your review.",
  },
  {
    slug: "lead-scout-home-services",
    name: "Lead Scout — Home Services",
    appIds: ["lead-scout", "email-drafter"],
    useCases: ["lead-generation", "sales-outreach"],
    industries: ["home-services", "contractors"],
    tier: "studio_plus",
    workflow: [
      "Sweep Google Maps for plumbers, electricians, and landscapers in your target towns",
      "Flag the ones running on a Facebook page instead of a real website",
      "Draft outreach that names the specific gap you can fix for them",
      "Stage the drafts in your Approval Inbox for one-tap review",
    ],
    integrations: ["google-maps", "gmail", "business-brain"],
    completion: "22 home-service businesses matched your filter. 9 strong fits, drafts staged for approval.",
  },
  {
    slug: "follow-up-sweep-runner",
    name: "Follow-Up Sweep Runner",
    appIds: ["follow-up-sweeps", "email-drafter"],
    useCases: ["lead-generation", "sales-outreach"],
    industries: [],
    tier: "pro",
    workflow: [
      "Search Gmail for contacts with no reply in 14 days",
      "Cross-check your brain's customer files and Lead Scout leads for anyone gone quiet",
      "Draft a warm reactivation email in the owner's voice for each one",
      "Stage each draft in the Approval Inbox for review",
      "Skip anyone you've marked leave-alone",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Drafted 5 follow-ups from your 12 stale leads. Ready for your approval.",
  },
  {
    slug: "cold-outreach-composer",
    name: "Cold Outreach Composer",
    appIds: ["email-drafter", "lead-scout"],
    useCases: ["lead-generation", "sales-outreach"],
    industries: ["sales-teams", "agencies", "consultants"],
    tier: "pro",
    workflow: [
      "Read the prospect list you pasted or the one Lead Scout built",
      "Pull real proof from your brain — past wins, numbers, names you're allowed to use",
      "Write each opener with a specific reason you're reaching out, never a template blast",
      "End every email with one clear, low-friction next step",
      "Stage the batch for your approval",
    ],
    integrations: ["gmail", "linkedin", "business-brain"],
    completion: "Composed 8 openers from your prospect list. Each one names why them, why now. Staged for review.",
  },
  {
    slug: "market-landscape-scanner",
    name: "Market Landscape Scanner",
    appIds: ["competitor-inspector"],
    useCases: ["lead-generation", "research"],
    industries: ["sales-teams", "agencies", "consultants"],
    tier: "pro_plus",
    workflow: [
      "Map the players in a vertical you name — who sells what, at what price point",
      "Verify every claim against the source before it lands in your brain",
      "File a structured landscape brief with the gaps worth selling into",
      "Flag the segments where your offer wins on a real difference",
    ],
    integrations: ["web", "business-brain"],
    completion: "Scanned the Nashville staffing market: 14 players mapped, 3 underserved segments flagged in your brief.",
  },
  {
    slug: "pipeline-review-manager",
    name: "Pipeline Review Manager",
    appIds: ["followups", "daily-brief"],
    useCases: ["sales-outreach", "operations"],
    industries: ["sales-teams"],
    tier: "pro",
    workflow: [
      "Scan your brain for every open deal and its last touch",
      "Rank the pipeline by which deals are going cold first",
      "Draft the nudge for each deal that needs one today",
      "Write the one-page review with the single most important call to make",
    ],
    integrations: ["gmail", "hubspot", "business-brain"],
    completion: "Reviewed 17 open deals. Three need attention today — nudges drafted, review on your desk.",
  },
  {
    slug: "prospect-call-briefer",
    name: "Prospect Call Briefer",
    appIds: ["daily-brief", "upcoming"],
    useCases: ["research", "sales-outreach"],
    industries: ["sales-teams", "consultants", "coaches"],
    tier: "pro",
    workflow: [
      "Read tomorrow's calls from your calendar",
      "Pull every past email and note you have on each prospect",
      "Write a one-page brief per call — who they are, where it left off, what to ask",
      "File the briefs in your brain and surface them in your morning read",
    ],
    integrations: ["google-calendar", "gmail", "linkedin", "business-brain"],
    completion: "Three calls tomorrow, three briefs filed. The 10am with Marcus at Beacon has an open question from May — it's flagged.",
  },
  {
    slug: "proposal-drafter",
    name: "Proposal Drafter",
    appIds: ["proposal-generator"],
    useCases: ["sales-outreach", "operations"],
    industries: ["consultants", "agencies"],
    tier: "pro",
    workflow: [
      "Take the client name and scope you drop in",
      "Read your brain for services, pricing, and the proof points that fit",
      "Draft the full proposal — summary, deliverables, investment, next steps — in your voice",
      "Stage it as a Gmail draft with the PDF attached, waiting on your send",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Proposal for the Delta Wellness project drafted — 6 sections, PDF attached, staged as a Gmail draft.",
  },
  {
    slug: "quote-writer",
    name: "Quote Writer",
    appIds: ["quote"],
    useCases: ["sales-outreach", "operations"],
    industries: ["contractors", "home-services"],
    tier: "starter",
    workflow: [
      "Take the job details you type or dictate from the truck",
      "Read your brain for your services, rates, and how you position them",
      "Produce a structured quote in your voice, line items and all",
      "Hold it for your review before it reaches the customer",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Quote drafted for the Hendersonville deck job: 4 line items, your standard terms. One tap to send.",
  },

  // ————— Content —————
  {
    slug: "landing-page-shipper",
    name: "Landing Page Shipper",
    appIds: ["landing-page-builder"],
    useCases: ["content-creation", "idea-to-mvp"],
    industries: [],
    tier: "studio",
    workflow: [
      "Take the page you describe — the offer, the audience, the one clear ask",
      "Write the copy in your voice from what your brain knows about the business",
      "Build the page on your own GitHub and Vercel accounts, step by step",
      "Stage every step for your approval, then hand you the live link",
    ],
    integrations: ["github", "vercel", "business-brain"],
    completion: "Your service page is live. The copy, the code, and the accounts it runs on are all yours.",
  },
  {
    slug: "newsletter-composer",
    name: "Newsletter Composer",
    appIds: ["email-drafter"],
    useCases: ["content-creation"],
    industries: ["coaches", "consultants", "real-estate"],
    tier: "starter",
    workflow: [
      "Read the last two weeks of your brain — client themes, wins, questions that kept coming up",
      "Draft this week's newsletter in your voice, anchored to one concrete story",
      "Write three subject lines that won't get filtered",
      "Stage the draft for your edit and approval",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Newsletter drafted from last week's session themes. Three subject lines to pick from. Staged for your edit.",
  },
  {
    slug: "social-post-composer",
    name: "Social Post Composer",
    appIds: ["email-drafter"],
    useCases: ["content-creation"],
    industries: [],
    tier: "starter",
    workflow: [
      "Pull this week's raw material from your brain — captures, notes, customer questions",
      "Draft a batch of posts in your voice, one idea per post",
      "Vary the shape — a story, a hard-won rule, a before-and-after",
      "Stage the batch for your review; you post what you approve",
    ],
    integrations: ["business-brain"],
    completion: "Five posts drafted from Tuesday's voice memo and two client questions. Pick the ones that sound like you.",
  },
  {
    slug: "content-repurposer",
    name: "Content Repurposer",
    appIds: ["youtube", "podcasts", "email-drafter"],
    useCases: ["content-creation", "research"],
    industries: ["coaches", "agencies"],
    tier: "pro",
    workflow: [
      "Ingest the episode or video you drop in — yours or anyone's",
      "Pull the claims, stories, and numbers worth keeping",
      "Draft a newsletter section and three posts from what it found",
      "File the source notes in your brain so the material stays quotable",
    ],
    integrations: ["youtube", "podcasts", "business-brain"],
    completion: "Pulled 6 quotable moments from the episode. One newsletter section and three post drafts staged.",
  },
  {
    slug: "kb-article-drafter",
    name: "KB Article Drafter",
    appIds: ["email-drafter", "daily-brief"],
    useCases: ["support", "content-creation"],
    industries: [],
    tier: "pro",
    workflow: [
      "Watch for the customer questions you answer more than once",
      "Draft a help article from your actual replies, in your voice",
      "Keep the steps concrete — what to click, what to expect",
      "Stage the article for your review before it's filed",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "You've answered the rescheduling question four times this month. Article drafted from your best reply.",
  },

  // ————— Research —————
  {
    slug: "podcast-ingester",
    name: "Podcast Episode Ingester",
    appIds: ["podcasts"],
    useCases: ["research", "content-creation"],
    industries: [],
    tier: "pro",
    workflow: [
      "Listen to the episode link you drop in",
      "Pull what matters by use case — a competitor's claim, a pricing tactic, a customer quote",
      "File a clean note in your brain with the source attached",
      "Watch the shows you follow and catch every new episode",
    ],
    integrations: ["podcasts", "business-brain"],
    completion: "Episode ingested: two pricing tactics and one competitor claim filed. You skipped 90 minutes of audio.",
  },
  {
    slug: "youtube-channel-watcher",
    name: "YouTube Channel Watcher",
    appIds: ["youtube"],
    useCases: ["research", "content-creation"],
    industries: [],
    tier: "pro",
    workflow: [
      "Watch the channels you name for every new upload",
      "Read each video and pull the parts that touch your market",
      "File what matters in your brain, sorted by use case",
      "Skip the uploads that have nothing for you — no noise in the brain",
    ],
    integrations: ["youtube", "business-brain"],
    completion: "Two of five new uploads mattered: one competitor feature launch, one objection worth a reply. Both filed.",
  },
  {
    slug: "competitor-site-inspector",
    name: "Competitor Site Inspector",
    appIds: ["competitor-inspector"],
    useCases: ["research"],
    industries: [],
    tier: "pro_plus",
    workflow: [
      "Read the competitor site you paste, the way a designer would",
      "Record the offer, the pricing, the layout, and what moves on the page",
      "Write a structured profile into your brain — style and structure, never their words",
      "Flag what's worth borrowing and what to skip, for your approval",
    ],
    integrations: ["web", "business-brain"],
    completion: "Profile filed: they lead with financing, bury the guarantee, and their booking flow is two taps shorter than yours.",
  },
  {
    slug: "web-page-scraper",
    name: "Web Page Scraper",
    appIds: ["competitor-inspector"],
    useCases: ["research"],
    industries: [],
    tier: "pro_plus",
    workflow: [
      "Pull the page you point at into clean, readable text",
      "Strip the menus, ads, and footers — keep the content",
      "Verify the pull actually captured the page before filing anything",
      "File it in your brain with the source and the date, so it stays traceable",
    ],
    integrations: ["firecrawl", "web", "business-brain"],
    completion: "Captured the pricing page you flagged — 1,200 words of clean text filed with today's date.",
  },
  {
    slug: "customer-voice-extractor",
    name: "Customer Voice Extractor",
    appIds: ["daily-brief"],
    useCases: ["research", "content-creation"],
    industries: ["agencies", "coaches", "med-spas"],
    tier: "pro_plus",
    workflow: [
      "Read the reviews, replies, and call notes you point it at",
      "Pull the exact phrases customers use for the problem and the win",
      "Sort the language by what they want, what they fear, what convinced them",
      "File a voice sheet in your brain your outreach and pages can quote",
    ],
    integrations: ["web", "business-brain"],
    completion: "Voice sheet filed from 40 reviews: customers say 'stopped chasing invoices' — nobody says 'accounts receivable.'",
  },

  // ————— Operations —————
  {
    slug: "weekly-ritual-runner",
    name: "Weekly Ritual Runner",
    appIds: ["ritual-scheduler"],
    useCases: ["operations"],
    industries: [],
    tier: "starter",
    workflow: [
      "Take the job you describe once, in plain words — no schedules to configure",
      "Run it on the rhythm you set: every Monday at 8, the first of the month, whenever you said",
      "Put the result in Mission Control before you sit down",
      "Pause, edit, or retire the ritual from one place",
    ],
    integrations: ["business-brain"],
    completion: "Monday 8:00am — your pipeline review ran. Three deals need you; the summary is in Mission Control.",
  },
  {
    slug: "capture-inbox-triage",
    name: "Capture Inbox Triage",
    appIds: ["daily-brief"],
    useCases: ["operations"],
    industries: [],
    tier: "starter",
    workflow: [
      "Catch everything you throw at it — voice memos, screenshots, forwarded emails, ideas",
      "Sort each capture by what it is and where it belongs",
      "File it in your brain where you'll actually find it again",
      "Surface the ones that need a decision in your morning read",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Nine captures triaged overnight: six filed, two added to your brief, one flagged as a decision you owe.",
  },
  {
    slug: "daily-brief-writer",
    name: "Daily Brief Writer",
    appIds: ["daily-brief"],
    useCases: ["operations"],
    industries: [],
    tier: "starter",
    workflow: [
      "Scan your brain overnight — deals, deadlines, promises, open loops",
      "Write the morning read: what's on the radar, what's pending, what's slipping",
      "Name the one thing to move on today, and why it's the one",
      "Have it waiting before your first coffee",
    ],
    integrations: ["business-brain", "gmail"],
    completion: "Your brief is ready. The one thing today: the Ridgeline proposal — they go to committee Thursday.",
  },
  {
    slug: "weekly-digest-writer",
    name: "Weekly Digest Writer",
    appIds: ["daily-brief", "followups"],
    useCases: ["operations"],
    industries: [],
    tier: "pro",
    workflow: [
      "Roll up the week from your brain — what moved, what stalled, what landed",
      "Compare against last week so the trend is visible, not just the snapshot",
      "Write the Friday digest with real numbers, not vibes",
      "File it so next quarter's review writes itself",
    ],
    integrations: ["business-brain", "gmail"],
    completion: "Week 26 digest filed: 4 deals advanced, 2 stalled, follow-up rate up from last week. Full read in Mission Control.",
  },
  {
    slug: "website-watchdog",
    name: "Website Watchdog",
    appIds: ["website-monitor"],
    useCases: ["operations"],
    industries: ["agencies", "home-services", "real-estate"],
    tier: "pro",
    workflow: [
      "Watch the pages that matter — your site, your checkout, a client's landing page",
      "Check each one on the schedule you set",
      "Alert Mission Control the moment one goes down, slows, or changes",
      "Warn you before a security certificate lapses, not after",
    ],
    integrations: ["web"],
    completion: "Your client's booking page went down at 6:42am. The alert was waiting before they ever noticed.",
  },
  {
    slug: "invoice-chaser",
    name: "Invoice Chaser",
    appIds: ["email-drafter", "followups"],
    useCases: ["operations"],
    industries: ["contractors", "consultants", "coaches"],
    tier: "pro",
    workflow: [
      "Read your books for every invoice past due",
      "Draft the reminder you hate writing — firm, warm, in your voice",
      "Escalate the tone on the second and third pass, the way you would",
      "Stage every reminder for your approval before it sends",
    ],
    integrations: ["quickbooks", "gmail", "business-brain"],
    completion: "Three invoices past due, three reminders drafted. The 45-day one got the firmer version. Your call to send.",
  },
  {
    slug: "browser-job-operator",
    name: "Browser Job Operator",
    appIds: ["browser-agent"],
    useCases: ["operations"],
    industries: [],
    tier: "studio_plus",
    workflow: [
      "Run the sites that don't connect to anything — portals, dashboards, forms",
      "Work them the way a person would: read the screen, click, type",
      "Stop at every irreversible step and wait for your approval",
      "Keep a screenshot record of everything it did",
    ],
    integrations: ["web"],
    completion: "Filled the vendor portal renewal through step 6. The final submit is held for your approval, screenshots attached.",
  },

  // ————— Support —————
  {
    slug: "support-inbox-triage",
    name: "Support Inbox Triage",
    appIds: ["email-drafter", "daily-brief"],
    useCases: ["support", "operations"],
    industries: ["med-spas", "agencies", "home-services"],
    tier: "pro",
    workflow: [
      "Read every inbound customer email as it lands",
      "Sort by what it needs — a quick answer, a booking change, a real decision",
      "Draft the reply for the routine ones, matched to the customer's tone",
      "Escalate the ones that need you, with the context already pulled",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Eleven inbound emails triaged: eight replies drafted, two bookings flagged, one refund escalated to you.",
  },
  {
    slug: "customer-reply-drafter",
    name: "Customer Reply Drafter",
    appIds: ["email-drafter"],
    useCases: ["support"],
    industries: [],
    tier: "starter",
    workflow: [
      "Read the customer email you forward or flag",
      "Pull the history — every past conversation you've had with them",
      "Draft the reply in your voice, matched to how they wrote to you",
      "Hold it for your review; you send, it learns",
    ],
    integrations: ["gmail", "business-brain"],
    completion: "Reply drafted for Sara at Delta — it references her March order without you digging for it. Staged for review.",
  },

  // ————— Idea → MVP —————
  {
    slug: "idea-to-plan-engine",
    name: "Idea-to-Plan Engine",
    appIds: ["idea-engine"],
    useCases: ["idea-to-mvp"],
    industries: [],
    tier: "pro_plus",
    workflow: [
      "Take the idea however it arrives — typed, a voice memo, a link you were watching",
      "Scan the market for who's already doing it and where the gap is",
      "Write the MVP plan — what to build first, what to skip, what to charge",
      "Stage the plan for your approval before anything gets built",
    ],
    integrations: ["business-brain", "web"],
    completion: "Your booking-tool idea, planned: 3 competitors mapped, the wedge is same-day scheduling. Plan staged for approval.",
  },
  {
    slug: "mvp-ship-runner",
    name: "MVP Ship Runner",
    appIds: ["idea-engine", "landing-page-builder"],
    useCases: ["idea-to-mvp"],
    industries: [],
    tier: "studio_plus",
    workflow: [
      "Take the plan you approved from the Idea Engine",
      "Build the working product on your own GitHub, Vercel, and Supabase accounts",
      "Stage each build step for your approval as it goes",
      "End with a live link and your first 25 outreach drafts — not another prompt box",
    ],
    integrations: ["github", "vercel", "supabase", "business-brain"],
    completion: "It's live. The working link, the signup form, the database — all on your accounts. 25 outreach drafts staged.",
  },
];

const BY_SLUG = new Map(AGENTS_LIBRARY.map((a) => [a.slug, a]));

export function getLibraryAgent(slug: string): LibraryAgent | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Agents tagged with a use case, in library order. Pass a limit for page rails. */
export function agentsForUseCase(useCase: UseCaseFilter, limit?: number): LibraryAgent[] {
  const matches = AGENTS_LIBRARY.filter((a) => a.useCases.includes(useCase));
  return typeof limit === "number" ? matches.slice(0, limit) : matches;
}

export const USE_CASE_FILTERS: { slug: UseCaseFilter; label: string }[] = [
  { slug: "lead-generation", label: "Lead Generation" },
  { slug: "sales-outreach", label: "Sales Outreach" },
  { slug: "content-creation", label: "Content" },
  { slug: "research", label: "Research" },
  { slug: "operations", label: "Operations" },
  { slug: "support", label: "Support" },
  { slug: "idea-to-mvp", label: "Idea to MVP" },
];

export const INDUSTRY_FILTERS: { slug: IndustryFilter; label: string }[] = [
  { slug: "coaches", label: "Coaches" },
  { slug: "consultants", label: "Consultants" },
  { slug: "contractors", label: "Contractors" },
  { slug: "med-spas", label: "Med Spas" },
  { slug: "agencies", label: "Agencies" },
  { slug: "sales-teams", label: "Sales Teams" },
  { slug: "home-services", label: "Home Services" },
  { slug: "wellness", label: "Wellness" },
  { slug: "real-estate", label: "Real Estate" },
];

/** True when an agent should appear under an industry chip — untagged agents fit everyone. */
export function agentFitsIndustry(agent: LibraryAgent, industry: IndustryFilter): boolean {
  return agent.industries.length === 0 || agent.industries.includes(industry);
}

/**
 * The plain-English spec a library card feeds the Custom Agent Builder when a signed-in owner
 * clicks Clone on /app/agents (PA-POS-37). The workflow lines already describe what the agent
 * actually does, review-first — joined, they read like an owner-typed spec, so a clone rides
 * the SAME compose → gate → approval-card flow as a free-form spec. No parallel clone pipeline.
 */
export function libraryAgentSpec(agent: LibraryAgent): string {
  return `Clone the "${agent.name}" agent from the Agents Library. It should: ${agent.workflow.join("; ")}.`;
}
