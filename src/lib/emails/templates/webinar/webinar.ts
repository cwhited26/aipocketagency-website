// lib/emails/templates/webinar/* — the 20 webinar-funnel emails (GTM Phase 5A, Part 3D). Reminders +
// live + replay + the 12-email post-webinar nurture. GPT-Hormozi voice rides verbatim (no slop scan,
// no voice swaps). Each is a pure data function returning { subject, html, text } via composeEmail.
//
// Buttons point at the marketing funnel (not in-app deep links) because these go to not-yet-customers.
// The live "Join" link + replay URL come from the configurable webinar env (lib/webinar/config.ts) so
// no room/replay URL is hardcoded; everything else uses the funnel pages under SITE_ORIGIN.

import { composeEmail, SITE_ORIGIN, type RenderedEmail } from "../../render";
import type { BaseEmailProps } from "../shared";
import { webinarJoinUrl, webinarReplayUrl } from "@/lib/webinar/config";

// The Idea Engine paragraph is reproduced byte-for-byte from the v5 copy wherever it appears (voice
// policy). Keep this constant the single source so the two emails that use it never drift.
const IDEA_ENGINE_PARAGRAPH =
  "Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the shower. Pocket Agent validates whether real people would buy it, plans the version that should actually ship, builds it for you, gets a sales page live, and lines up the first 25 prospects to email. By the time you finish your morning coffee, your idea is a real thing on the internet you can show people.";

const TAGLINE = "Generic AI starts from zero. Pocket Agent starts from your business.";

const FUNNEL = {
  start: `${SITE_ORIGIN}/start`,
  pricing: `${SITE_ORIGIN}/pricing`,
  workspace: `${SITE_ORIGIN}/start?tier=studio_plus`,
  pilot: `${SITE_ORIGIN}/downsell`,
  diyKit: `${SITE_ORIGIN}/downsell-kit`,
  trainingConfirmed: `${SITE_ORIGIN}/training-confirmed`,
} as const;

// ── Email 1: Registration confirmation (immediate) ────────────────────────────────────────────────
export function registrationConfirmation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You're in — Build Your AI Team",
    blocks: [
      { kind: "p", text: "You're registered." },
      { kind: "p", text: "Training: Build Your AI Team Without Becoming An AI Expert" },
      {
        kind: "p",
        text: "On this training, you'll see how owner-led businesses can use Pocket Agent to build:",
      },
      { kind: "bullets", items: ["A Business Brain.", "Clone-and-customize Personas.", "Workflow Apps.", "Mission Control."] },
      { kind: "p", text: "The goal is simple:" },
      {
        kind: "p",
        text: "Turn scattered business context into an AI Agent Workspace that remembers, drafts, researches, captures, builds, prepares, and reports back.",
      },
      { kind: "p", text: TAGLINE },
      { kind: "button", label: "Add To Calendar", href: FUNNEL.trainingConfirmed },
      { kind: "p", text: "Watch for your reminder emails from chase@aipocketagent.com." },
    ],
  });
}

// ── Email 2: 24-hour reminder ─────────────────────────────────────────────────────────────────────
export function reminder24h(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Tomorrow: build your AI team",
    blocks: [
      { kind: "p", text: "Tomorrow I'm going to show you how to build your AI team without becoming technical." },
      { kind: "p", text: "Most business owners do not need another chatbot." },
      {
        kind: "p",
        text: "They need one place where their AI knows their company, offers, customers, voice, workflows, and what needs to happen next.",
      },
      { kind: "p", text: "That is what we are covering." },
      { kind: "bullets", items: ["Business Brain.", "Personas.", "Apps.", "Mission Control."] },
      { kind: "p", text: "You'll also see how Idea Engine turns a rough idea into a real thing on the internet." },
      { kind: "p", text: "Not a prompt pack." },
      { kind: "p", text: "Not a blueprint you execute later." },
      { kind: "p", text: "A working asset you can show people." },
      { kind: "p", text: TAGLINE },
      { kind: "button", label: "Join The Training", href: webinarJoinUrl() },
    ],
  });
}

// ── Email 3: Morning of webinar ───────────────────────────────────────────────────────────────────
export function morningOf(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Today: Build Your AI Team",
    blocks: [
      { kind: "p", text: "Today is the training: Build Your AI Team Without Becoming An AI Expert" },
      { kind: "p", text: "Here is what to pay attention to:" },
      {
        kind: "bullets",
        items: [
          "How to build your Business Brain.",
          "How to clone your first Personas.",
          "How Personas use Apps.",
          "How Mission Control keeps you in control.",
          "How to hit 3-3-3 activation.",
        ],
      },
      { kind: "p", text: "That means: 3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      { kind: "p", text: "Do not come looking for theory." },
      { kind: "p", text: "Come looking for the first installation path." },
      { kind: "button", label: "Join The Training", href: webinarJoinUrl() },
    ],
  });
}

// ── Email 4: 1-hour reminder ──────────────────────────────────────────────────────────────────────
export function reminder1h(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Starting in 1 hour",
    blocks: [
      { kind: "p", text: "We start in 1 hour." },
      { kind: "p", text: "Training: Build Your AI Team Without Becoming An AI Expert" },
      {
        kind: "p",
        text: "You'll see how Pocket Agent helps owner-led businesses replace generic AI chaos with: Business Brain. Personas. Apps. Mission Control.",
      },
      { kind: "p", text: "Bring one question:" },
      { kind: "p", text: "Where is your business context scattered right now?" },
      { kind: "p", text: "Email? CRM? Notes? Screenshots? Docs? Spreadsheets? Your head?" },
      { kind: "p", text: "That is what Pocket Agent fixes." },
      { kind: "button", label: "Join The Training", href: webinarJoinUrl() },
    ],
  });
}

// ── Email 5: 15-minute reminder ───────────────────────────────────────────────────────────────────
export function reminder15m(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Starting in 15 minutes",
    blocks: [
      { kind: "p", text: "We start in 15 minutes." },
      { kind: "p", text: "Click below to join." },
      { kind: "button", label: "Join Now", href: webinarJoinUrl() },
      { kind: "p", text: TAGLINE },
    ],
  });
}

// ── Email 6: Live now ─────────────────────────────────────────────────────────────────────────────
export function liveNow(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "We're live",
    blocks: [
      { kind: "p", text: "We're live now." },
      { kind: "p", text: "Join here:" },
      { kind: "button", label: "Join The Training", href: webinarJoinUrl() },
      {
        kind: "p",
        text: "We are covering: Business Brain. Personas. Apps. Mission Control. Idea Engine. 3-3-3 activation.",
      },
      { kind: "p", text: "Join now." },
    ],
  });
}

// ── Email 7: Missed you / replay available (no-shows) ────────────────────────────────────────────
export function missedReplay(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Replay: Build Your AI Team",
    blocks: [
      { kind: "p", text: "You missed the live training." },
      { kind: "p", text: "The replay is available now." },
      { kind: "p", text: "Watch it here:" },
      { kind: "button", label: "Watch The Replay", href: webinarReplayUrl() },
      { kind: "p", text: "This training shows how Pocket Agent helps owner-led businesses build:" },
      { kind: "bullets", items: ["A Business Brain.", "Clone-and-customize Personas.", "Workflow Apps.", "Mission Control."] },
      { kind: "p", text: "You'll also see why Idea Engine is different from another prompt pack." },
      { kind: "p", text: "Other tools hand you a blueprint." },
      { kind: "p", text: "Idea Engine ends with a working website you can share." },
      { kind: "p", text: TAGLINE },
    ],
  });
}

// ── Email 8: Attendee replay / offer recap (attendees) ───────────────────────────────────────────
export function attendeeRecap(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Pocket Agent offer recap",
    blocks: [
      { kind: "p", text: "Thanks for attending the training." },
      { kind: "p", text: "Here is the recap." },
      { kind: "p", text: "Pocket Agent is the AI Agent Workspace for owner-led businesses." },
      { kind: "p", text: "The system: Business Brain. Personas. Apps. Mission Control." },
      { kind: "p", text: "Your first milestone: 3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      {
        kind: "p",
        text: "Start any paid Pocket Agent subscription and get the AI Office Launch Kit included free.",
      },
      { kind: "p", text: "Inside, you get:" },
      {
        kind: "bullets",
        items: [
          "Business Brain Setup Checklist.",
          "3 starter Personas.",
          "5 starter workflow templates.",
          "Mission Control Review Checklist.",
          "7-Day Setup Plan.",
          "Pocket Agent Launchpad access.",
          "30 prebuilt Skills auto-seeded into your Business Brain based on your tier.",
        ],
      },
      { kind: "button", label: "Build My AI Team", href: FUNNEL.start },
    ],
  });
}

// ── Email 9: Problem agitation (Day 1) ───────────────────────────────────────────────────────────
export function problemAgitation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Generic AI still makes you do the work",
    blocks: [
      { kind: "p", text: "Most AI tools are smart." },
      { kind: "p", text: "But they still make you do the work." },
      {
        kind: "bullets",
        items: [
          "You explain the business.",
          "You explain the offer.",
          "You explain the customer.",
          "You explain the tone.",
          "You explain what happened last time.",
          "You explain the next step.",
        ],
      },
      { kind: "p", text: "Then you copy the output somewhere else." },
      { kind: "p", text: "That is why generic AI still feels like work." },
      {
        kind: "p",
        text: "Pocket Agent gives your business one place for: Business memory. AI roles. Workflow tools. Owner approval.",
      },
      { kind: "p", text: "Business Brain. Personas. Apps. Mission Control." },
      { kind: "p", text: TAGLINE },
      { kind: "button", label: "Build My AI Team", href: FUNNEL.start },
    ],
  });
}

// ── Email 10: Business Brain (Day 2) ─────────────────────────────────────────────────────────────
export function businessBrain(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your AI needs a brain first",
    blocks: [
      { kind: "p", text: "Most people start with the wrong question." },
      { kind: "p", text: 'They ask: "What prompt should I use?"' },
      { kind: "p", text: "Wrong starting point." },
      {
        kind: "p",
        text: 'The better question is: "What context should my AI know before it does any work?"',
      },
      { kind: "p", text: "That is why Pocket Agent starts with Business Brain." },
      { kind: "p", text: "Your Business Brain is your company memory in markdown, stored in your own git repo." },
      { kind: "p", text: "Start with:" },
      {
        kind: "p",
        text: "Your offer. Your services. Your FAQs. Your best emails. Your customer notes. Your screenshots. Your saved links. Your past AI chats. Your workflows. Your brand voice.",
      },
      { kind: "p", text: "That is how your AI stops starting from zero." },
      { kind: "button", label: "Start Pocket Agent", href: FUNNEL.start },
    ],
  });
}

// ── Email 11: Personas (Day 3) ───────────────────────────────────────────────────────────────────
export function personas(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "The first 3 AI roles I'd build",
    blocks: [
      { kind: "p", text: "Do not start by building 20 AI agents." },
      { kind: "p", text: "That is how people get overwhelmed." },
      { kind: "p", text: "Start with 3 Personas." },
      { kind: "p", text: "Admin Assistant. Follow-Up Agent. Content Creator." },
      { kind: "p", text: "Why these?" },
      { kind: "p", text: "Admin removes operational drag." },
      { kind: "p", text: "Follow-Up Agent helps prevent leads and conversations from slipping." },
      { kind: "p", text: "Content Creator turns ideas, notes, screenshots, podcasts, and videos into assets." },
      { kind: "p", text: "Pocket Agent ships with 7 clone-and-customize Personas:" },
      {
        kind: "p",
        text: "Admin Assistant. Sales Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher. Operations Chief of Staff.",
      },
      { kind: "p", text: "Pick the role. Add your context. Use an App. Review in Mission Control." },
      { kind: "button", label: "Build My AI Team", href: FUNNEL.start },
    ],
  });
}

// ── Email 12: Apps (Day 4) ───────────────────────────────────────────────────────────────────────
export function apps(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Persona is the role. App is the tool.",
    blocks: [
      { kind: "p", text: "A Persona is the role." },
      { kind: "p", text: "An App is the tool." },
      { kind: "p", text: "A Persona uses Apps." },
      { kind: "p", text: "That is what makes Pocket Agent different from a blank chatbot." },
      { kind: "p", text: "Your Lead Researcher can use Lead Scout." },
      { kind: "p", text: "Your Email Drafter can use Email Drafter." },
      { kind: "p", text: "Your Follow-Up Agent can use Follow-Up Sweeps." },
      {
        kind: "p",
        text: "Your Content Creator can use YouTube Ingester, Podcast Ingester, Landing Page Builder, and Idea Engine.",
      },
      { kind: "p", text: "Your Operations Chief of Staff can use Brain Map, Decision Roundtable, and Mission Control." },
      { kind: "p", text: "Generic AI answers questions." },
      { kind: "p", text: "Pocket Agent helps move work forward." },
      { kind: "button", label: "See Plans", href: FUNNEL.pricing },
    ],
  });
}

// ── Email 13: Idea Engine (Day 5) ────────────────────────────────────────────────────────────────
export function ideaEngine(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your shower idea should not die in Notes",
    blocks: [
      { kind: "p", text: "Most entrepreneurs do not have an idea problem." },
      { kind: "p", text: "They have an execution problem." },
      { kind: "p", text: "They hear a podcast idea." },
      { kind: "p", text: "They save a YouTube tactic." },
      { kind: "p", text: "They get a thought in the shower." },
      { kind: "p", text: "They notice a customer problem." },
      { kind: "p", text: "Then the idea dies." },
      { kind: "p", text: "Idea Engine is built for that." },
      { kind: "p", text: IDEA_ENGINE_PARAGRAPH },
      { kind: "p", text: "Other tools hand you a blueprint and prompts." },
      { kind: "p", text: "Idea Engine ends with a working website you can share." },
      { kind: "p", text: "Idea Engine is included in AI Agent Workspace at $497/month." },
      { kind: "button", label: "Unlock AI Agent Workspace", href: FUNNEL.workspace },
    ],
  });
}

// ── Email 14: Lead Scout (Day 6) ─────────────────────────────────────────────────────────────────
export function leadScout(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Lead Researcher needs a real vertical",
    blocks: [
      { kind: "p", text: "Generic lead research creates generic lists." },
      { kind: "p", text: "That is not useful." },
      { kind: "p", text: "Lead Scout gives your Lead Researcher structure." },
      {
        kind: "p",
        text: "Pick a vertical. Pick a market. Give it your offer. Review the prospects. Use Mission Control to decide what moves forward.",
      },
      {
        kind: "p",
        text: "Lead Scout includes vertical packs for: Roofing. HVAC. Painting. General Contracting. Med Spa. Law Firm. Dentist.",
      },
      { kind: "p", text: "Then your Follow-Up Agent and Email Drafter can help prepare the next touch." },
      { kind: "button", label: "Build My Lead Research Agent", href: FUNNEL.workspace },
    ],
  });
}

// ── Email 15: Mission Control (Day 7) ────────────────────────────────────────────────────────────
export function missionControl(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "AI should not run wild in your business",
    blocks: [
      { kind: "p", text: "Business owners have a healthy fear." },
      { kind: "p", text: "They do not want AI running wild." },
      { kind: "p", text: "They do not want random emails going out." },
      { kind: "p", text: "They do not want pages published without approval." },
      { kind: "p", text: "They do not want agents making decisions they never reviewed." },
      { kind: "p", text: "Good." },
      { kind: "p", text: "That fear is rational." },
      { kind: "p", text: "That is why Pocket Agent has Mission Control." },
      {
        kind: "p",
        text: "Mission Control shows what was: Captured. Drafted. Researched. Queued. Summarized. Built. Prepared.",
      },
      { kind: "p", text: "You review. You approve. You stay in control." },
      { kind: "p", text: "AI does the prep. You stay in control." },
      { kind: "button", label: "Build My AI Team", href: FUNNEL.start },
    ],
  });
}

// ── Email 16: Guarantee (Day 8) ──────────────────────────────────────────────────────────────────
export function guarantee(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "The only guarantee we make",
    blocks: [
      { kind: "p", text: "Here is the only guarantee." },
      { kind: "p", text: "Complete the Launch Kit's 7-day setup steps." },
      {
        kind: "p",
        text: "If you do not have 3 trained Personas and 3 working workflows inside Pocket Agent by day 7, we help you finish the setup.",
      },
      { kind: "p", text: "We are not guaranteeing revenue." },
      { kind: "p", text: "We are not promising magic." },
      { kind: "p", text: "We are guaranteeing implementation." },
      { kind: "p", text: "Because implementation is the real bottleneck." },
      { kind: "p", text: "Your first milestone is simple: 3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      { kind: "p", text: "That is when Pocket Agent becomes real." },
      { kind: "button", label: "Start Pocket Agent", href: FUNNEL.start },
    ],
  });
}

// ── Email 17: Plan choice (Day 9) ────────────────────────────────────────────────────────────────
export function planChoice(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Which Pocket Agent plan should you choose?",
    blocks: [
      { kind: "p", text: "Not sure which plan to choose?" },
      { kind: "p", text: "Use this rule." },
      {
        kind: "p",
        text: "Personal Brain — $37/month — Choose this if you are a solo owner who wants one Business Brain.",
      },
      {
        kind: "p",
        text: "Business Agent — $97/month — Choose this if you are an owner-led business that wants Personas, Apps, integrations, Mission Control, and 20 Skills. This is the main starting point.",
      },
      {
        kind: "p",
        text: "AI Agent Workspace — $497/month — Choose this if you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, full cockpit, and all 30 Skills.",
      },
      { kind: "p", text: "Behind see all plans: Pro+ — $149/month. Studio — $297/month. Enterprise — custom." },
      { kind: "p", text: "Most businesses should start with Business Agent. If you want the heavy hitter, choose AI Agent Workspace." },
      { kind: "button", label: "Choose My Plan", href: FUNNEL.pricing },
    ],
  });
}

// ── Email 18: Last call (Day 10) ─────────────────────────────────────────────────────────────────
export function lastCall(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Last call: build your AI team",
    blocks: [
      { kind: "p", text: "This is your last call from the replay sequence." },
      { kind: "p", text: "You can keep using generic AI tools." },
      { kind: "p", text: "You can keep explaining your business every time." },
      { kind: "p", text: "You can keep copying outputs into other tools." },
      { kind: "p", text: "You can keep saving ideas that never ship." },
      { kind: "p", text: "You can keep letting follow-ups live in your head." },
      { kind: "p", text: "Or you can build the first version of your AI Agent Workspace." },
      { kind: "p", text: "Business Brain. Personas. Apps. Mission Control." },
      { kind: "p", text: "Start any paid Pocket Agent subscription and get the AI Office Launch Kit included free." },
      { kind: "p", text: "Your first goal: 3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      { kind: "p", text: TAGLINE },
      { kind: "button", label: "Build My AI Team", href: FUNNEL.start },
    ],
  });
}

// ── Email 19: 14-Day Pilot pitch (Day 11) ────────────────────────────────────────────────────────
export function pilotPitch(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Not ready? Start with the 14-Day Pilot",
    blocks: [
      { kind: "p", text: "Not ready for a full subscription?" },
      { kind: "p", text: "Start with the 14-Day Pilot." },
      { kind: "p", text: "For $97 one-time, you get:" },
      {
        kind: "p",
        text: "Business Brain starter. 1 Persona. 1 workflow. 1 Mission Control review. 14-day access to the Pilot Track inside Pocket Agent Launchpad.",
      },
      { kind: "p", text: "If you upgrade within 30 days, your $97 credits toward your subscription." },
      { kind: "p", text: "This is not a free trial." },
      { kind: "p", text: "Free trials attract dabblers." },
      { kind: "p", text: "Paid pilots attract operators." },
      { kind: "p", text: "Build one useful loop. Then decide." },
      { kind: "button", label: "Start My 14-Day Pilot", href: FUNNEL.pilot },
    ],
  });
}

// ── Email 20: DIY Setup Kit pitch (Day 12) ───────────────────────────────────────────────────────
export function diyKitPitch(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Want to set it up yourself?",
    blocks: [
      { kind: "p", text: "If you want to set up Pocket Agent yourself, do not start from a blank page." },
      { kind: "p", text: "Grab the AI Office DIY Setup Kit." },
      { kind: "p", text: "It is a downloadable bundle that includes:" },
      {
        kind: "p",
        text: "Business Brain Upload Checklist. 3 Persona setup templates. Workflow templates. 7-Day Plan. Example prompts.",
      },
      { kind: "p", text: "This does not include full Pocket Agent Launchpad access." },
      { kind: "p", text: "This is not Done-With-You Setup." },
      { kind: "p", text: "It is the shortcut for people who want the instructions and want to execute themselves." },
      { kind: "button", label: "Get The DIY Setup Kit", href: FUNNEL.diyKit },
    ],
  });
}
