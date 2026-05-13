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
  heroPill: "[ capture · what your ai remembers ]",
  heroHeadline: "Tap once. Your AI captures the rest.",
  heroSubhead:
    "Voice memos, screenshots, share links, emails, Loom recordings — your Pocket Agent files all of it without you typing a word. Nothing dies in your head.",
  catalogLabel: "what your ai captures",
  catalogHeadline: "Five ways your AI remembers things for you.",
  catalogIntro:
    "Friction equals forgotten. Remove the friction, the memory compounds. Each capability goes live in your Pocket Agent one at a time — every capture lands in the same place, gets organized automatically, becomes searchable forever.",
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
      title: "Share Sheet URL → Your AI",
      blurb:
        "Hit Share on any URL — Safari, Facebook, X, LinkedIn — type one word, it lands in your Pocket Agent organized. Your home-screen graveyard becomes a real research pile.",
      status: "live",
      liveHref:
        "https://github.com/cwhited26/aipocketagency-brain/blob/main/automations/brain-inbox-shortcut-recipe.md",
      liveCta: "Get the setup guide",
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
  pricingLabel: "how it works",
  pricingHeadline: "Your Pocket Agent gets sharper every week. $97/mo includes everything as it arrives.",
  pricingParagraphs: [
    "A VA who could transcribe your voice, categorize your screenshots, parse your emails, fetch Loom transcripts, and remember every Facebook save would cost you $2,000–4,000 a month. Your Pocket Agent does all of it.",
    "Each capability also sells as a standalone $15 playbook when it goes live, if you want just that piece. Pocket Agent members get every new capability as it arrives — no separate purchase, no separate setup. It just shows up.",
  ],
  formLabel: "get notified",
  formHeadline: "Get notified when the next capability goes live.",
  formSubhead:
    "One email when each new feature is ready. No drip. No upsell sequence.",
  formCta: "Notify me when it's live",
  successLine: "You're on the list. We'll email you when the next one goes live.",
};

export const OUTPUT_PACK: WaitlistBundle = {
  slug: "output_pack",
  pageTitle: "Output Pack — AI Pocket Agency",
  heroPill: "[ output · what your ai gives back ]",
  heroHeadline: "Your AI works while you sleep.",
  heroSubhead:
    "Daily standups before coffee. Pre-call briefs. Customer Q&A in your voice. Competitive intel. Content from past wins. Your Pocket Agent just runs. Decision Query is live now.",
  catalogLabel: "what your ai gives back",
  catalogHeadline: "Eight ways your AI does the work for you.",
  catalogIntro:
    "Without outputs you have a sophisticated note-taking system. With outputs you have a second brain that works for you. Your Pocket Agent runs these on a schedule or on demand and delivers something useful straight to your phone.",
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
        "Live sales call. Objection raised. Your phone silently surfaces the proven handler from your objection bank. Read it natural, close the deal.",
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
      liveCta: "See how it works",
    },
    {
      code: "O8",
      title: "MVP Signal",
      blurb:
        "When five prospects mention the same pain in 30 days, the brain pings you: 'heads up — MVP candidate'. Pattern matching while you're heads-down shipping.",
      status: "coming-soon",
    },
  ],
  pricingLabel: "how it works",
  pricingHeadline:
    "Your Pocket Agent gets sharper every week. $97/mo includes everything as it arrives.",
  pricingParagraphs: [
    "What you'd pay an EA + a junior marketer + a sales analyst + a content writer to do all of this — badly — is $8,000–15,000 a month. Your Pocket Agent does it.",
    "Each capability also sells as a standalone $15 playbook when it goes live. Pocket Agent members get every new capability as it arrives — no separate purchase, no separate setup. Decision Query is live now. The rest are coming behind it.",
  ],
  formLabel: "get notified",
  formHeadline: "Get notified when the next capability goes live.",
  formSubhead:
    "One email when each new feature is ready. No drip. No upsell sequence.",
  formCta: "Notify me when it's live",
  successLine: "You're on the list. We'll email you when the next one goes live.",
};
