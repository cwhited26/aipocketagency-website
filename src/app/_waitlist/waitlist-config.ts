/**
 * Source of truth for the two "Coming Soon" bundle landing pages —
 * Capture Pack (5 modules) and Output Pack (8 modules). Each module
 * has a `status` flag the page renders as a badge:
 *
 *   • `live`         → `[ LIVE ]` (green)
 *   • `coming-soon`  → `[ COMING SOON ]` (slate)
 *
 * As a module ships, flip its status here. The catalog is publicly
 * visible from day one — Russell-pattern anticipation building before
 * product completion (APA Decision Log).
 *
 * The module rows mirror the source specs at:
 *   • ~/whited-brain/APA/Products/Capture_Pack_Spec.md
 *   • ~/whited-brain/APA/Products/Output_Pack_Spec.md
 */

export type WaitlistModuleStatus = "live" | "coming-soon";

export type WaitlistModule = {
  /** Module short code, e.g. "C1", "O3". */
  code: string;
  /** Display title, e.g. "Voice → Brain". */
  title: string;
  /** One-line value prop from the source spec. */
  blurb: string;
  status: WaitlistModuleStatus;
  /**
   * Optional internal anchor / external link displayed when the module
   * is `live`. Used today by C3 Share Sheet URL to point at the install
   * recipe in whited-brain.
   */
  liveHref?: string;
  /** Optional CTA label paired with `liveHref` (defaults to "Install"). */
  liveCta?: string;
};

export type WaitlistBundle = {
  /**
   * Slug posted to /api/apa/leads as `waitlist_for` (underscore form —
   * matches the `apa_leads.waitlist_for` column values). Distinct from
   * the URL path (`/capture-pack`, `/output-pack`) which uses hyphens.
   */
  slug: "capture_pack" | "output_pack";
  /** Page title rendered in <title> + hero. */
  pageTitle: string;
  /** Mono "[ ... ]" pill above the hero headline. */
  heroPill: string;
  /** Hero headline (gradient text). */
  heroHeadline: string;
  /** Hero subhead beneath the headline. */
  heroSubhead: string;
  /** Mono section label on the catalog block. */
  catalogLabel: string;
  /** Heading on the catalog block. */
  catalogHeadline: string;
  /** Intro paragraph above the module grid. */
  catalogIntro: string;
  /** Module rows. */
  modules: WaitlistModule[];
  /** Mono section label on the pricing/anchor block. */
  pricingLabel: string;
  /** Pricing headline (Hormozi anchor). */
  pricingHeadline: string;
  /** Pricing supporting paragraphs. */
  pricingParagraphs: string[];
  /** Mono section label on the form block. */
  formLabel: string;
  /** Form block headline. */
  formHeadline: string;
  /** Form block subhead. */
  formSubhead: string;
  /** Button label on the form. */
  formCta: string;
  /** Success-state line after submit. */
  successLine: string;
};

export const CAPTURE_PACK: WaitlistBundle = {
  slug: "capture_pack",
  pageTitle: "Capture Pack — AI Pocket Agency",
  heroPill: "[ capture pack · waitlist ]",
  heroHeadline: "Tap once. The brain captures the rest.",
  heroSubhead:
    "Five modules that turn your phone — voice, screenshot, share sheet, email, Loom — into a friction-free door into your AI Pocket Agency. The first one is live tonight.",
  catalogLabel: "the catalog",
  catalogHeadline: "Five capture modules. One door into the brain.",
  catalogIntro:
    "Friction equals forgotten. Remove the friction, the brain compounds. Each module is a 5-minute install on top of your existing AI Pocket Agency setup — every capture lands in the same inbox, gets the same consolidation pass, becomes searchable forever.",
  modules: [
    {
      code: "C1",
      title: "Voice → Brain",
      blurb:
        "Tap a Shortcut, talk for 60 seconds, your AI files it. Driving thoughts, shower ideas, walking calls — nothing dies in your head.",
      status: "coming-soon",
    },
    {
      code: "C2",
      title: "Screenshot → Brain",
      blurb:
        "Take a screenshot, your AI OCRs it, tags it, and files it. Competitor pricing pages and customer DMs stop disappearing into your screenshots folder.",
      status: "coming-soon",
    },
    {
      code: "C3",
      title: "Share Sheet URL → Brain",
      blurb:
        "Hit Share on any URL — Safari, Facebook, X, LinkedIn — type one word, it lands in your brain organized. Your home-screen graveyard becomes a real research pile.",
      status: "live",
      liveHref:
        "https://github.com/cwhited26/whited-brain/blob/main/automations/brain-inbox-shortcut-recipe.md",
      liveCta: "Install recipe",
    },
    {
      code: "C4",
      title: "Email Forward → Brain",
      blurb:
        "Forward any email to brain@<yourdomain> — customer replies, competitor newsletters, leads. Parsed, threaded, searchable. The inbox stops eating things.",
      status: "coming-soon",
    },
    {
      code: "C5",
      title: "Loom URL → Brain",
      blurb:
        "Paste a Loom link. Transcript + summary + action items in your brain in under 30 seconds. The 'I'll watch this later' graveyard dies.",
      status: "coming-soon",
    },
  ],
  pricingLabel: "the deal",
  pricingHeadline: "Bundle when complete: $47 for all 5. Today: free waitlist.",
  pricingParagraphs: [
    "A VA who could transcribe your voice, categorize your screenshots, parse your emails, fetch Loom transcripts, and remember every Facebook save would cost you $2,000–4,000 a month. The Capture Pack runs on your $20/mo Anthropic key. One-time $47 when the full pack ships.",
    "Per-module $15 kits ship as each module locks in — Dispatch Playbook pattern. Buyer self-selects. Stack à la carte. Today: get on the list and you'll be first in line for each module as it goes live.",
  ],
  formLabel: "the list",
  formHeadline: "Get notified when each module ships.",
  formSubhead:
    "No drip. No upsell sequence. Just an email the moment a module flips to LIVE so you can install it before anybody else.",
  formCta: "Save my spot",
  successLine: "You're on the list. We'll email you as each module ships.",
};

export const OUTPUT_PACK: WaitlistBundle = {
  slug: "output_pack",
  pageTitle: "Output Pack — AI Pocket Agency",
  heroPill: "[ output pack · waitlist ]",
  heroHeadline: "Your brain works while you sleep.",
  heroSubhead:
    "Eight modules that turn captured context into action — daily standups, pre-call briefs, customer Q&A in your voice, compete-watch, content from past wins. Plain-English Decision Query is live tonight; the rest of the operating layer ships behind it.",
  catalogLabel: "the catalog",
  catalogHeadline: "Eight output modules. Your brain in motion.",
  catalogIntro:
    "Without outputs you have a sophisticated note-taking system. With outputs you have an operating layer. Every module reads your brain on a schedule (or on demand) and delivers something useful to your phone — standup before coffee, brief before every call, content drafts in your voice.",
  modules: [
    {
      code: "O1",
      title: "Daily Standup",
      blurb:
        "Yesterday you shipped X, Y, Z. Today's calendar has these calls. The brain flagged two stale items. Sent to iMessage, Slack, or email the moment your alarm goes off.",
      status: "coming-soon",
    },
    {
      code: "O2",
      title: "Pre-Call Brief",
      blurb:
        "Every external call gets a brief: who you're meeting, what you decided last time, open threads, what to drive. Five-second read, walk in informed.",
      status: "coming-soon",
    },
    {
      code: "O3",
      title: "Customer Q&A in Your Voice",
      blurb:
        "Customer asks a question — within 30 seconds you get a draft answer in your voice with sources cited. Tap to approve, send. The 'I'll respond later' pile dies.",
      status: "coming-soon",
    },
    {
      code: "O4",
      title: "Real-Time Objection Handler (V2)",
      blurb:
        "Live sales call. Objection raised. Your phone silently surfaces the proven handler from your objection bank. Read it natural, close the deal. V2 — ships after the V1 modules are generating revenue.",
      status: "coming-soon",
    },
    {
      code: "O5",
      title: "Weekly Compete-Watch",
      blurb:
        "Sunday afternoon brief: this week's competitor activity, by competitor, by theme. Pricing trends, hook patterns, anomalies. Five-minute read replaces hours of 'I keep meaning to check'.",
      status: "coming-soon",
    },
    {
      code: "O6",
      title: "Content From Past Wins",
      blurb:
        "Agent reads your decision log + sales calls + customer Q&A and drafts 3–5 content pieces in your voice — Skool post, LinkedIn, drip email, ad hook. Tied to themes that recur. No more blank page.",
      status: "coming-soon",
    },
    {
      code: "O7",
      title: "Plain-English Decision Query",
      blurb:
        "Ask 'what did we decide about Patrick's PDF cover?' Answer in three seconds with the exact decision log entry and session excerpt cited. The 'I know we figured this out' graveyard dies.",
      status: "live",
      liveHref: "/output-pack/decision-query",
      liveCta: "Install recipe",
    },
    {
      code: "O8",
      title: "MVP Signal",
      blurb:
        "When five prospects mention the same pain in 30 days, the brain pings you: 'heads up — MVP candidate'. Pattern matching while you're heads-down shipping.",
      status: "coming-soon",
    },
  ],
  pricingLabel: "the deal",
  pricingHeadline:
    "Founder Brain $97. Sales Brain $97. Full Output Pack $147. Today: free waitlist.",
  pricingParagraphs: [
    "What you'd pay an EA + a junior marketer + a sales analyst + a content writer to do all of this — badly — is $8,000–15,000 a month. The Output Pack runs on your $20–50/mo Anthropic key.",
    "Founder Brain bundle (O1 + O2 + O5 + O7 + O8): the operator's pack. Sales Brain bundle (O2 + O3 + O5 + O6 + O4 when V2 ships): pre-call brief + customer Q&A + compete-watch + content drafts. Full Output Pack: all 7 V1 modules. Per-module $15 kits ship as each module locks in. Get on the list today and you're first in line.",
  ],
  formLabel: "the list",
  formHeadline: "Get notified when each module ships.",
  formSubhead:
    "No drip. No upsell sequence. Just an email the moment a module flips to LIVE so you can install it before anybody else.",
  formCta: "Save my spot",
  successLine: "You're on the list. We'll email you as each module ships.",
};
