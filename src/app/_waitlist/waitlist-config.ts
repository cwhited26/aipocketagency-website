export type WaitlistModule = {
  code: string;
  title: string;
  blurb: string;
};

export type WaitlistBundle = {
  slug: "capture_pack" | "output_pack";
  pageTitle: string;
  heroPill: string;
  heroHeadline: string;
  heroSubhead: string;
  catalogLabel: string;
  catalogHeadline: string;
  catalogIntro: string;
  modules: WaitlistModule[];
  pricingLabel: string;
  pricingHeadline: string;
  pricingParagraphs: string[];
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
    "Friction equals forgotten. Remove the friction, the memory compounds. Each capability goes live in your Pocket Agent one at a time — every capture lands in the same place, organized automatically, searchable forever.",
  modules: [
    {
      code: "C1",
      title: "Voice → remembered",
      blurb:
        "Tap a Shortcut, talk for 60 seconds, your AI files it. Driving thoughts, shower ideas, walking calls — nothing dies in your head.",
    },
    {
      code: "C2",
      title: "Screenshot → searchable",
      blurb:
        "Take a screenshot, your AI tags it and files it. Competitor pricing pages and customer DMs stop disappearing into the screenshots folder.",
    },
    {
      code: "C3",
      title: "Share any URL → organized",
      blurb:
        "Hit Share on any URL — Safari, Facebook, X, LinkedIn — type one word, it lands in your Pocket Agent organized. Your home-screen graveyard becomes a real research pile.",
    },
    {
      code: "C4",
      title: "Email → searchable",
      blurb:
        "Forward any email to your brain address — customer replies, competitor newsletters, leads. Parsed, threaded, searchable. The inbox stops eating things.",
    },
    {
      code: "C5",
      title: "Loom → transcript + summary",
      blurb:
        "Paste a Loom link. Transcript + summary + action items in your Pocket Agent in under 30 seconds. The 'I'll watch this later' graveyard dies.",
    },
  ],
  pricingLabel: "how it works",
  pricingHeadline: "Your Pocket Agent gets sharper every week. $97/mo includes everything as it arrives.",
  pricingParagraphs: [
    "A VA who could transcribe your voice, categorize your screenshots, parse your emails, fetch Loom transcripts, and remember every Facebook save would cost you $2,000–4,000 a month. Your Pocket Agent does all of it.",
    "New capabilities also sell as standalone $15 PDFs when they go live, if you want just that piece. Pocket Agent members get every new capability as it arrives — no separate purchase, no separate setup. It just shows up.",
  ],
};

export const OUTPUT_PACK: WaitlistBundle = {
  slug: "output_pack",
  pageTitle: "Output Pack — AI Pocket Agency",
  heroPill: "[ output · what your ai gives back ]",
  heroHeadline: "Your AI works while you sleep.",
  heroSubhead:
    "Daily standups before coffee. Pre-call briefs. Customer Q&A in your voice. Competitive intel. Content from past wins. Your Pocket Agent just runs.",
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
    },
    {
      code: "O2",
      title: "Pre-Call Brief",
      blurb:
        "Every external call gets a brief: who you're meeting, what you decided last time, open threads, what to drive. Five-second read, walk in informed.",
    },
    {
      code: "O3",
      title: "Customer Q&A in Your Voice",
      blurb:
        "Customer asks a question — within 30 seconds you get a draft answer in your voice with sources cited. Tap to approve, send. The 'I'll respond later' pile dies.",
    },
    {
      code: "O4",
      title: "Real-Time Objection Handler",
      blurb:
        "Live sales call. Objection raised. Your phone silently surfaces the proven handler from your objection bank. Read it natural, close the deal.",
    },
    {
      code: "O5",
      title: "Weekly Compete-Watch",
      blurb:
        "Sunday afternoon brief: this week's competitor activity, by competitor, by theme. Pricing trends, hook patterns, anomalies. Five-minute read replaces hours of 'I keep meaning to check'.",
    },
    {
      code: "O6",
      title: "Content From Past Wins",
      blurb:
        "Your AI reads your decisions and past work and drafts three to five content pieces in your voice — Skool post, LinkedIn, drip email, ad hook. Tied to themes that keep recurring. No blank page.",
    },
    {
      code: "O7",
      title: "Plain-English Decision Query",
      blurb:
        "Ask 'what did we decide about Patrick's PDF cover?' Answer in three seconds with the exact decision log entry and session excerpt cited. The 'I know we figured this out' graveyard dies.",
    },
    {
      code: "O8",
      title: "MVP Signal",
      blurb:
        "When five prospects mention the same pain in 30 days, the brain pings you: 'heads up — MVP candidate'. Pattern matching while you're heads-down shipping.",
    },
  ],
  pricingLabel: "how it works",
  pricingHeadline:
    "Your Pocket Agent gets sharper every week. $97/mo includes everything as it arrives.",
  pricingParagraphs: [
    "An EA + a junior marketer + a sales analyst + a content writer doing all of this — badly — would cost you $8,000–$15,000 a month. Your Pocket Agent does it.",
    "New capabilities also sell as standalone $15 PDFs when they go live. Pocket Agent members get every new capability as it arrives — no separate purchase, no separate setup.",
  ],
};
