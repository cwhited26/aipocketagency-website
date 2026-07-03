// lib/copy/in-app.ts — the in-app product copy bank (GTM Phase 4, Part 7).
//
// Source: the Part-7 "In-App Onboarding + Product Copy + Empty States" doc, authored by a Custom
// GPT trained on Hormozi's $100M Money Models. The GPT-Hormozi voice is INTENTIONAL and shipped
// as written — no slop scan, no voice swaps (per the lane brief). Every surface that needs this
// copy imports from here so the language stays consistent and a future edit happens in one place.
//
// Hard rules still apply: domain aipocketagent.com only, no real customer names, and the Idea
// Engine empty-state paragraph is byte-for-byte from source (pinned by a unit test).

import type { NudgeKey, ProgressCopyKey } from "@/lib/activation/state";

/** The common shape for an empty state / screen block. All fields optional but headline. */
export type ScreenCopy = {
  headline: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  secondaryCta?: string;
  microcopy?: string;
};

// ── Part 7A: global app language ────────────────────────────────────────────────────────────────
export const GLOBAL = {
  productLine: "Generic AI starts from zero. Pocket Agent starts from your business.",
  businessBrain: "Business Brain = your company memory.",
  personas: "Personas = the WHO.",
  apps: "Apps = the WHAT.",
  missionControl: "Mission Control = where you review and approve everything.",
  activation:
    "Your first goal is 3-3-3 activation: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
  control: "AI does the prep. You stay in control.",
  usage: "Flat monthly bill. Clear usage allowances. No surprise bills.",
} as const;

// ── Part 7B: first login experience ───────────────────────────────────────────────────────────
export const WELCOME: ScreenCopy = {
  headline: "Welcome to Pocket Agent.",
  subheadline: "Let's build your first AI Agent Workspace.",
  body: "Do not try to set up everything today.\n\nYour first goal is simple: 3 Business Brain assets. 3 trained Personas. 3 working workflows.\n\nThat is 3-3-3 activation. Once you hit that, Pocket Agent becomes real inside your business.",
  cta: "Start My Setup",
  secondaryCta: "Skip For Now",
  microcopy: "You can always return to this setup path from your dashboard.",
};

export type BottleneckOption = {
  key: string;
  label: string;
  description: string;
  persona: string;
  apps: string;
};

export const BOTTLENECK_PICKER = {
  headline: "What do you want Pocket Agent to help with first?",
  subheadline: "Pick the bottleneck that costs you the most time, money, or momentum.",
  cta: "Continue",
  microcopy: "You can add more later. Start with one bottleneck.",
  options: [
    {
      key: "admin",
      label: "Admin",
      description: "Help organize tasks, context, replies, and daily priorities.",
      persona: "Admin Assistant",
      apps: "Capture Inbox, Mission Control, Brain Map",
    },
    {
      key: "follow_up",
      label: "Follow-Up",
      description: "Help find stalled conversations and prepare the next touch.",
      persona: "Follow-Up Agent",
      apps: "Follow-Up Sweeps, Email Drafter, Mission Control",
    },
    {
      key: "content",
      label: "Content",
      description: "Help turn ideas, notes, videos, and podcasts into usable assets.",
      persona: "Content Creator",
      apps: "Capture Inbox, YouTube Ingester, Podcast Ingester, Landing Page Builder",
    },
    {
      key: "email",
      label: "Email",
      description: "Help draft replies in your voice using your business context.",
      persona: "Email Drafter",
      apps: "Email Drafter, Mission Control",
    },
    {
      key: "lead_research",
      label: "Lead Research",
      description: "Help find and organize prospects.",
      persona: "Lead Researcher",
      apps: "Lead Scout, Mission Control",
    },
    {
      key: "operations",
      label: "Operations",
      description: "Help organize decisions, workflows, and operating context.",
      persona: "Operations Chief of Staff",
      apps: "Brain Map, Mission Control, Decision Roundtable",
    },
    {
      key: "ideas",
      label: "Ideas",
      description: "Help turn rough ideas into real things people can see.",
      persona: "Content Creator or Operations Chief of Staff",
      apps: "Idea Engine, Landing Page Builder, Mission Control",
    },
  ] satisfies BottleneckOption[],
};

export const SETUP_PATH = {
  headline: "Your 7-day setup path",
  subheadline: "Follow these steps to install Pocket Agent inside your business.",
  cta: "Start With Business Brain",
  steps: [
    "Step 1: Add 3 Business Brain assets.",
    "Step 2: Clone your first Persona.",
    "Step 3: Install your first workflow.",
    "Step 4: Review in Mission Control.",
    "Step 5: Join Pocket Agent Launchpad.",
    "Step 6: Add two more Personas.",
    "Step 7: Complete 3-3-3 activation.",
  ],
};

// ── Part 7C: main dashboard ─────────────────────────────────────────────────────────────────────
export const DASHBOARD = {
  header: {
    headline: "Build your AI team from your business context.",
    subheadline:
      "Your first milestone is 3-3-3 activation: 3 Business Brain assets, 3 trained Personas, and 3 working workflows.",
    primaryCta: "Continue Setup",
    secondaryCta: "Open Mission Control",
  },
  widgetTitle: "Your 3-3-3 Activation",
  widgetCta: "Continue My Setup",
  /** Progress-state checklist labels at 0 of 3 / not-yet. */
  checklist: {
    businessBrain: "Business Brain assets",
    personas: "Personas",
    workflows: "Workflows",
    missionControl: "Mission Control",
    launchpad: "Launchpad",
  },
  quickActions: [
    "Add Business Brain Asset",
    "Clone Persona",
    "Install Workflow",
    "Open Mission Control",
    "Join Launchpad",
    "Run Lead Scout",
    "Use Idea Engine",
  ],
} as const;

/** Part 7C progress copy, keyed to the activation percentage block. */
export const PROGRESS_COPY: Record<ProgressCopyKey, string> = {
  start:
    "Start with your Business Brain. Pocket Agent needs your business context before your agents can do useful work.",
  brain_ready: "Good. Your Business Brain has context. Now clone your first Persona.",
  personas_ready: "Your Personas are ready. Now install workflows so they can do real work.",
  almost: "You are almost activated. Review your first outputs in Mission Control.",
  complete:
    "3-3-3 activation complete. Pocket Agent is installed at the foundation level. Now stack the next workflow.",
};

// ── Part 7D: Business Brain ───────────────────────────────────────────────────────────────────
export const BUSINESS_BRAIN = {
  empty: {
    headline: "Your Business Brain is empty.",
    subheadline:
      "Pocket Agent cannot start from your business until you add your business context.",
    body: "Your Business Brain is your company memory in markdown, stored in your own git repo.\n\nStart with 3 assets: Your offer. Your voice. Your customer questions.\n\nThat is enough to make your first Personas useful.",
    cta: "Add My First Asset",
    secondaryCta: "Use Starter Template",
    microcopy: "Useful beats perfect. You can improve your Business Brain over time.",
  } satisfies ScreenCopy,
  upload: {
    headline: "Add business context.",
    subheadline: "Give Pocket Agent the context it needs to produce useful work.",
    cta: "Add To Business Brain",
  } satisfies ScreenCopy,
  uploadOptions: [
    "Paste Text — Best for offers, FAQs, notes, and voice examples.",
    "Upload File — Best for docs, sales material, SOPs, and existing resources.",
    "Add Link — Best for pages, references, and saved resources.",
    "Add Screenshot — Best for visual examples, ideas, competitor pages, and inspiration.",
    "Import Past AI Chat — Best for prompts, outputs, ideas, and previous AI work you want Pocket Agent to remember.",
  ],
  success: {
    headline: "Business Brain asset added.",
    subheadline: "Pocket Agent now has more context to work from.",
    body: "Now clone your first Persona so it can use this context.",
    cta: "Clone My First Persona",
    secondaryCta: "Add Another Asset",
  } satisfies ScreenCopy,
  qualityNudge: {
    headline: "Output feels generic?",
    body: "Pocket Agent can only use the context it has.\n\nAdd better Business Brain assets: Clearer offer details. Better voice samples. Customer objections. Follow-up examples. FAQs. Do-not-say list. Workflow rules.",
    cta: "Improve My Business Brain",
  } satisfies ScreenCopy,
  mapEmpty: {
    headline: "Your Brain Map will appear after you add more context.",
    subheadline: "Brain Map helps you see and organize the shape of your Business Brain.",
    body: "Add offers, voice samples, customer questions, workflows, links, screenshots, and decisions. Then use Brain Map to see what your agents know and where context is missing.",
    cta: "Add Business Context",
  } satisfies ScreenCopy,
};

// ── Part 7E: Personas ───────────────────────────────────────────────────────────────────────────
export const PERSONAS = {
  empty: {
    headline: "You have not cloned a Persona yet.",
    subheadline: "Personas are the WHO — trained AI roles inside your business.",
    body: "Start with one role.\n\nIf your bottleneck is admin, choose Admin Assistant.\n\nIf leads are slipping, choose Follow-Up Agent.\n\nIf content is backed up, choose Content Creator.\n\nIf email takes too long, choose Email Drafter.\n\nIf you need prospects, choose Lead Researcher.",
    cta: "Clone My First Persona",
  } satisfies ScreenCopy,
  galleryHeader: {
    headline: "Choose a Persona to clone and customize.",
    subheadline:
      "Do not clone all seven at once. Start with the role that removes the most repeated work from your week.",
  } satisfies ScreenCopy,
  success: {
    headline: "Your Persona is ready.",
    subheadline: "Now give it a workflow.",
    body: "A Persona without a workflow is just a role. Install an App workflow so it can do useful work.",
    cta: "Install First Workflow",
    secondaryCta: "Clone Another Persona",
  } satisfies ScreenCopy,
  config: {
    headline: "Customize your Persona.",
    cta: "Save Persona",
  } satisfies ScreenCopy,
};

// ── Part 7F: Apps + Workflows ─────────────────────────────────────────────────────────────────
export const APPS = {
  empty: {
    headline: "Your Personas need Apps to do work.",
    subheadline: "A Persona is the role. An App is the tool. A Persona uses Apps.",
    body: "Start with one workflow.\n\nRecommended first workflows: Email Drafting. Follow-Up Sweeps. Capture Inbox to Content. Lead Scout run. Daily Mission Control Review.",
    cta: "Install My First Workflow",
  } satisfies ScreenCopy,
};

// ── Part 7G: Mission Control ──────────────────────────────────────────────────────────────────
export const MISSION_CONTROL = {
  empty: {
    // Poc is the character doing the prep (PA-POS-33) — the mascot beside this copy is Poc.
    headline: "Nothing yet — Poc will drop new drafts here as your agents work.",
    subheadline: "Mission Control fills up when your Personas use Apps to prepare work.",
    body: "Install a workflow first.\n\nGood first workflows: Email Drafting. Follow-Up Sweeps. Capture Inbox to Content. Lead Scout run.\n\nAI does the prep. You stay in control.",
    cta: "Install A Workflow",
  } satisfies ScreenCopy,
  header: {
    headline: "Mission Control",
    subheadline:
      "Review what your agents captured, drafted, researched, queued, built, and prepared.",
  } satisfies ScreenCopy,
  success: {
    headline: "Review complete.",
    subheadline: "You approved work instead of starting from zero.",
    body: "Run this workflow again or install the next one.",
    cta: "Run Again",
    secondaryCta: "Install Next Workflow",
  } satisfies ScreenCopy,
};

// ── Part 7H: Capture Inbox ────────────────────────────────────────────────────────────────────
export const CAPTURE_INBOX = {
  empty: {
    headline: "Your Capture Inbox is empty.",
    subheadline: "Stop letting ideas die in Notes.",
    body: "Capture raw business context: Voice memos. Screenshots. Saved links. Customer questions. Podcast ideas. YouTube insights. Offer ideas. Random thoughts.\n\nThen let your Personas turn them into useful assets.",
    cta: "Add First Capture",
  } satisfies ScreenCopy,
  success: {
    headline: "Captured.",
    subheadline: "Now decide what this should become.",
    cta: "Choose Next Action",
  } satisfies ScreenCopy,
};

// ── Part 7I: Email Drafter ────────────────────────────────────────────────────────────────────
export const EMAIL_DRAFTER = {
  empty: {
    headline: "No emails drafted yet.",
    subheadline: "Use Email Drafter to remove the blank page.",
    body: "Email Drafter uses your Business Brain context to prepare emails in your voice.\n\nGood first drafts: Customer reply. Quote follow-up. Cold intro. Proposal follow-up. Boundary-setting decline. Support response.",
    cta: "Draft My First Email",
  } satisfies ScreenCopy,
  output: {
    headline: "Draft ready.",
    microcopy: "Do not send client-facing emails without review.",
  } satisfies ScreenCopy,
};

// ── Part 7J: Follow-Up Sweeps ─────────────────────────────────────────────────────────────────
export const FOLLOW_UP_SWEEPS = {
  empty: {
    headline: "No follow-up sweeps yet.",
    subheadline: "Most businesses do not need more leads before they fix follow-up.",
    body: "Use Follow-Up Sweeps to find conversations that need another touch and prepare drafts for review.\n\nGood for: Quotes. Proposals. Inbound leads. Sales conversations. Old opportunities. Client check-ins.",
    cta: "Run My First Sweep",
  } satisfies ScreenCopy,
};

// ── Part 7K: Lead Scout ───────────────────────────────────────────────────────────────────────
export const LEAD_SCOUT = {
  empty: {
    headline: "No Lead Scout runs yet.",
    subheadline: "Stop asking AI for random leads.",
    body: "Lead Scout helps your Lead Researcher find prospects with vertical context.\n\nStart with one vertical.\n\nAvailable vertical packs: Roofing. HVAC. Painting. General Contracting. Med Spa. Law Firm. Dentist.",
    cta: "Run Lead Scout",
  } satisfies ScreenCopy,
  upgradeGate: {
    headline: "Lead Scout vertical packs are available in AI Agent Workspace.",
    body: "Upgrade to AI Agent Workspace to unlock Lead Scout vertical packs for: Roofing. HVAC. Painting. General Contracting. Med Spa. Law Firm. Dentist.\n\nYou also unlock Idea Engine, Decision Roundtable, full cockpit, and all 30 Skills.",
    cta: "Upgrade To AI Agent Workspace",
    secondaryCta: "See All Plans",
  } satisfies ScreenCopy,
};

// ── Part 7L: Idea Engine ──────────────────────────────────────────────────────────────────────
// The empty-state body is byte-for-byte from source (pinned by in-app.test.ts). Do not edit.
export const IDEA_ENGINE_EMPTY_BODY =
  "Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the shower. Pocket Agent validates whether real people would buy it, plans the version that should actually ship, builds it for you, gets a sales page live, and lines up the first 25 prospects to email. By the time you finish your morning coffee, your idea is a real thing on the internet you can show people.\n\nOther tools hand you a blueprint and prompts. Idea Engine ends with a working website you can share.";

export const IDEA_ENGINE = {
  empty: {
    headline: "Your next idea should not die in Notes.",
    subheadline: "Turn a rough idea into a real thing on the internet.",
    body: IDEA_ENGINE_EMPTY_BODY,
    cta: "Drop My First Idea",
  } satisfies ScreenCopy,
  processing: {
    headline: "Idea Engine is building your first version.",
    microcopy: "You will review everything before using it.",
  } satisfies ScreenCopy,
  processingSteps: [
    "Validating buyer demand.",
    "Planning what should ship.",
    "Building the sales page.",
    "Preparing first 25 prospects.",
    "Sending output to Mission Control.",
  ],
  output: {
    headline: "Your idea is ready to review.",
  } satisfies ScreenCopy,
  upgradeGate: {
    headline: "Idea Engine is available in AI Agent Workspace.",
    body: "Idea Engine turns rough ideas into real assets: Validation. Ship plan. Working sales page. First 25 prospects.\n\nOther tools give you prompts. Pocket Agent gives you a working website you can share.\n\nUpgrade to AI Agent Workspace to unlock Idea Engine, Lead Scout vertical packs, Decision Roundtable, full cockpit, and all 30 Skills.",
    cta: "Unlock Idea Engine",
  } satisfies ScreenCopy,
  proPlusGate: {
    headline: "Your plan includes the Idea Engine plan and prompts.",
    body: "Pro+ gives you the plan and prompts. Studio+ gets the whole thing actually built.\n\nUpgrade if you want Pocket Agent to build the working website and prepare the first prospect list.",
    cta: "Upgrade To Studio",
    secondaryCta: "Use Plan + Prompts",
  } satisfies ScreenCopy,
};

// ── Part 7M: YouTube Ingester ─────────────────────────────────────────────────────────────────
export const YOUTUBE = {
  empty: {
    headline: "No YouTube channels or videos added yet.",
    subheadline: "Turn YouTube content into usable business intelligence.",
    body: "Use YouTube Ingester to process videos, extract tactics, summarize ideas, and monitor channels with channel watch.\n\nGood for: Competitor research. Content ideas. Offer angles. Industry tactics. Customer education.",
    cta: "Ingest A YouTube Video",
    secondaryCta: "Watch A Channel",
  } satisfies ScreenCopy,
};

// ── Part 7N: Podcast Ingester ─────────────────────────────────────────────────────────────────
export const PODCAST = {
  empty: {
    headline: "No podcasts added yet.",
    subheadline: "Turn podcast insights into business assets.",
    body: "Use Podcast Ingester to process episodes, monitor shows with show watch, and extract ideas your Personas can use.\n\nGood for: Content ideas. Offer insights. Market research. Customer language. Tactic extraction.",
    cta: "Ingest Podcast Episode",
    secondaryCta: "Watch A Show",
  } satisfies ScreenCopy,
};

// ── Part 7O: Landing Page Builder ─────────────────────────────────────────────────────────────
export const LANDING_PAGE = {
  empty: {
    headline: "No landing pages built yet.",
    subheadline: "Turn offers, ideas, and campaigns into pages you can review.",
    body: "Use Landing Page Builder when you need a page for: An offer. A campaign. A lead magnet. A service. An idea. A Pilot. A niche page.\n\nFor full idea-to-page execution, use Idea Engine.",
    cta: "Build A Landing Page",
  } satisfies ScreenCopy,
  output: {
    headline: "Page draft ready.",
  } satisfies ScreenCopy,
  paPublishUpsell: {
    headline: "Want to publish this page?",
    body: "PA Publish lets you publish pages from Pocket Agent.\n\nAdd PA Publish for $200/year.",
    cta: "Add PA Publish",
  } satisfies ScreenCopy,
};

// ── Part 7P: Decision Roundtable ──────────────────────────────────────────────────────────────
export const DECISION_ROUNDTABLE = {
  empty: {
    headline: "No decisions reviewed yet.",
    subheadline: "Use Decision Roundtable to pressure-test important choices.",
    body: "Decision Roundtable helps you frame options, surface assumptions, run devil's advocate, check reversibility, and pre-mortem the decision before you act.\n\nBest for: Pricing decisions. Offer decisions. Hiring decisions. Campaign decisions. Product decisions. Strategic tradeoffs.\n\nAvailable on Studio+ and Enterprise.",
    cta: "Start Decision Roundtable",
  } satisfies ScreenCopy,
  upgradeGate: {
    headline: "Decision Roundtable is available on Studio+ and Enterprise.",
    body: "Upgrade when you need structured decision support: Three-option framing. Load-bearing assumption. Devil's advocate first pass. Reversibility check. Pre-mortem.",
    cta: "Upgrade To Studio",
  } satisfies ScreenCopy,
};

// ── Part 7Q: Build Tools ──────────────────────────────────────────────────────────────────────
export const BUILD_TOOLS = {
  empty: {
    headline: "No builds created yet.",
    subheadline: "Use Build Tools when you are ready to create and deploy.",
    body: "Build Tools can create GitHub repos, deploy to Vercel, provision Supabase, and run code-execution.\n\nUse this when your idea is ready to become a real working asset.\n\nBest with: Idea Engine. Landing Page Builder. PA Publish. Studio+ workflows.",
    cta: "Start A Build",
  } satisfies ScreenCopy,
  warning: {
    headline: "Review before deploying.",
    body: "Build Tools can create and deploy real assets.\n\nReview generated code, configuration, and deployment settings before approving.\n\nAI does the prep. You stay in control.",
    cta: "Review Build Plan",
  } satisfies ScreenCopy,
};

// ── Part 7R: Skills Library ───────────────────────────────────────────────────────────────────
export const SKILLS = {
  header: {
    headline: "Skills make your agents sharper.",
    subheadline: "Skills are reusable techniques your agents use to produce better work.",
  } satisfies ScreenCopy,
  empty: {
    headline: "Your Skills will appear here.",
    subheadline: "Skills are auto-seeded into your Business Brain based on your tier.",
    body: "Personal Brain includes 5 Skills. Business Agent includes 20 Skills. AI Agent Workspace includes all 30 Skills.",
    cta: "View My Skills",
  } satisfies ScreenCopy,
  locked: {
    headline: "Unlock more Skills by upgrading.",
    body: "Upgrade to unlock more reusable techniques for: Email Drafting. Sales. Research. Operations. Decision-shape.",
    cta: "Upgrade My Skills",
  } satisfies ScreenCopy,
};

// ── Part 7S: Pocket Agent Launchpad ───────────────────────────────────────────────────────────
export const LAUNCHPAD = {
  notJoined: {
    headline: "Join the Pocket Agent Launchpad.",
    body: "Software gives you the workspace. The Launchpad helps you install it.\n\nInside, follow the 7-Day Setup Plan, join implementation labs, post wins, and get to 3-3-3 activation.",
    cta: "Join The Launchpad",
  } satisfies ScreenCopy,
  joined: {
    headline: "You joined the Launchpad.",
    body: "Start with Module 0 and post your first implementation goal.\n\nYour first milestone: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
    cta: "Start Module 0",
  } satisfies ScreenCopy,
};

// ── Part 7T: plan upgrade prompts ─────────────────────────────────────────────────────────────
export type UpgradePromptCopy = {
  headline: string;
  body: string;
  cta: string;
  secondaryCta?: string;
};

export type UpgradeTransition =
  | "starter_to_pro"
  | "pro_to_studio_plus"
  | "pro_plus_to_studio"
  | "studio_to_studio_plus"
  | "studio_plus_to_enterprise";

export const UPGRADE_PROMPTS: Record<UpgradeTransition, UpgradePromptCopy> = {
  starter_to_pro: {
    headline: "Ready for Personas and Apps?",
    body: "Personal Brain is for one brain. Business Agent is for business workflows.\n\nUpgrade to Business Agent to unlock: Clone-and-customize Personas. Workflow Apps. Mission Control. Active integrations. 20 prebuilt Skills. AI Office Launch Kit. Pocket Agent Launchpad.",
    cta: "Upgrade To Business Agent",
  },
  pro_to_studio_plus: {
    headline: "Unlock the full AI Agent Workspace.",
    body: "AI Agent Workspace includes the heavy hitters: Idea Engine. Lead Scout vertical packs. Decision Roundtable. Full cockpit. All 30 Skills. Advanced Mission Control.\n\nIf you want ideas turned into live assets and prospects lined up, this is the tier.",
    cta: "Upgrade To AI Agent Workspace",
  },
  pro_plus_to_studio: {
    headline: "Ready for the build layer?",
    body: "Pro+ gives you the plan and prompts. Studio gives you deeper execution.\n\nUpgrade when you want Pocket Agent to move from planning into building.",
    cta: "Upgrade To Studio",
  },
  studio_to_studio_plus: {
    headline: "Unlock the full cockpit.",
    body: "AI Agent Workspace gives you: Idea Engine. Lead Scout vertical packs. Decision Roundtable. Full cockpit. All 30 Skills. Advanced Mission Control.",
    cta: "Unlock AI Agent Workspace",
  },
  studio_plus_to_enterprise: {
    headline: "Need custom usage, permissions, or implementation?",
    body: "Enterprise is for teams that need: Custom usage allowances. Advanced permissions. Team workflows. BYO LLM configuration. Custom implementation. Integrations. Enterprise support.",
    cta: "Apply For Enterprise",
  },
};

// ── Part 7U: add-on prompts ───────────────────────────────────────────────────────────────────
export const ADDON_PROMPTS = {
  paSync: {
    headline: "Add PA Sync.",
    body: "PA Sync keeps your workspace connected to the places your business context already lives.\n\nAdd PA Sync for $96/year.",
    cta: "Add PA Sync",
  } satisfies ScreenCopy,
  paPublish: {
    headline: "Publish your page with PA Publish.",
    body: "PA Publish lets you publish pages from Pocket Agent.\n\nAdd PA Publish for $200/year.",
    cta: "Add PA Publish",
  } satisfies ScreenCopy,
};

// ── Part 7V: usage limit prompts ──────────────────────────────────────────────────────────────
export type UsageLimitKind = "leads" | "whisper" | "sub_agent_runs";

export const USAGE_PROMPTS: Record<UsageLimitKind, ScreenCopy> = {
  leads: {
    headline: "You hit your lead allowance.",
    body: "You used the lead allowance included in your tier. That means your Lead Researcher is working.\n\nTo keep running Lead Scout and researching more prospects, upgrade to the next tier.\n\nFlat monthly bill. Clear usage allowances. No surprise bills.",
    cta: "Upgrade My Plan",
  },
  whisper: {
    headline: "You hit your Whisper hours allowance.",
    body: "You used the Whisper hours included in your tier.\n\nUpgrade if you want to keep processing audio, voice memos, podcasts, calls, or spoken content.",
    cta: "Upgrade My Usage",
  },
  sub_agent_runs: {
    headline: "You hit your sub-agent run allowance.",
    body: "You used the sub-agent runs included in your tier. That means your workspace is doing real agent work.\n\nUpgrade to continue running more agent workflows.",
    cta: "Upgrade My Plan",
  },
};

// ── Part 7W: in-app nudges by activation state ────────────────────────────────────────────────
export const NUDGES: Record<NudgeKey, ScreenCopy> = {
  no_business_brain: {
    headline: "Start with your Business Brain.",
    body: "Pocket Agent cannot start from your business until you add business context.\n\nAdd your first 3 assets: Offer. Voice. Customer questions.",
    cta: "Add Business Brain Assets",
  },
  business_brain_no_persona: {
    headline: "Your Business Brain needs a Persona.",
    body: "Now that Pocket Agent has context, give it a role.\n\nStart with Admin Assistant, Follow-Up Agent, or Content Creator.",
    cta: "Clone First Persona",
  },
  persona_no_workflow: {
    headline: "Your Persona needs a workflow.",
    body: "A Persona without a workflow is just a role.\n\nInstall one App workflow so it can prepare useful work.",
    cta: "Install First Workflow",
  },
  workflow_no_mission_control: {
    headline: "Review the work in Mission Control.",
    body: "Your workflow is installed. Now review what Pocket Agent prepared.\n\nAI does the prep. You stay in control.",
    cta: "Open Mission Control",
  },
  no_launchpad_join: {
    headline: "Use the Launchpad to finish setup.",
    body: "The Pocket Agent Launchpad gives you the 7-Day Setup Plan, implementation labs, workflow examples, and 3-3-3 activation path.",
    cta: "Join Launchpad",
  },
  activation_complete: {
    headline: "3-3-3 activation complete.",
    body: "Good. Pocket Agent is installed at the foundation level. Now stack the next loop.\n\nRecommended next workflows: Lead Scout. Idea Engine. Podcast Ingester. YouTube Ingester. Daily Mission Control Review.",
    cta: "Choose Next Workflow",
  },
};

// ── Part 7X: success states ───────────────────────────────────────────────────────────────────
export type SuccessKey =
  | "business_brain"
  | "persona"
  | "workflow"
  | "mission_control"
  | "activation_333";

export const SUCCESS: Record<SuccessKey, ScreenCopy> = {
  business_brain: {
    headline: "Business Brain started.",
    body: "Pocket Agent now has context from your business.\n\nNext: clone your first Persona.",
    cta: "Clone Persona",
  },
  persona: {
    headline: "Persona created.",
    body: "Your AI role is ready.\n\nNext: give it an App workflow.",
    cta: "Install Workflow",
  },
  workflow: {
    headline: "Workflow installed.",
    body: "Your Persona now has a repeatable job.\n\nNext: review output in Mission Control.",
    cta: "Open Mission Control",
  },
  mission_control: {
    headline: "First review complete.",
    body: "You reviewed AI-prepared work instead of starting from zero.\n\nNext: install the next workflow or complete 3-3-3 activation.",
    cta: "Continue Setup",
  },
  activation_333: {
    headline: "Your AI team is installed.",
    subheadline: "You completed 3-3-3 activation.",
    body: "You now have: 3 Business Brain assets. 3 trained Personas. 3 working workflows.\n\nPocket Agent is no longer just software. It is now installed inside your business.",
    cta: "Stack My Next Workflow",
    secondaryCta: "Post My Win In Launchpad",
  },
};

// ── Part 7Y: app-wide microcopy bank ──────────────────────────────────────────────────────────
export const MICROCOPY = {
  businessBrain: [
    "Your AI cannot use context it does not have.",
    "Useful beats perfect.",
    "Add context once. Let your agents reuse it.",
    "Your Business Brain compounds over time.",
    "Start with offer, voice, and customer questions.",
  ],
  persona: [
    "Persona is the WHO.",
    "Clone one role first.",
    "Do not build every Persona today.",
    "Pick the role that removes the most repeated work from your week.",
  ],
  apps: [
    "App is the WHAT.",
    "A Persona uses Apps.",
    "A workflow turns a role into work.",
    "Do not explore features. Install one useful loop.",
  ],
  missionControl: [
    "Review before sending.",
    "Approve before publishing.",
    "AI does the prep. You stay in control.",
    "Mission Control is your cockpit.",
  ],
  ideaEngine: [
    "Your idea should not die in Notes.",
    "Other tools give you prompts. Idea Engine gives you a working website you can share.",
    "Drop the idea. Review the output. Approve what moves forward.",
  ],
  leadScout: [
    "Stop asking AI for random leads.",
    "Pick one vertical.",
    "Review prospects before outreach.",
    "Research first. Outreach second.",
  ],
  usage: [
    "Flat monthly bill.",
    "Clear usage allowances.",
    "No surprise bills.",
    "Hit a cap? Upgrade to the next tier.",
  ],
} as const;
