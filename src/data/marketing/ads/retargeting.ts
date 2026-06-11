// 10 retargeting ads — Part 6D. Copy filed byte-for-byte (GPT-Hormozi voice).
// `script` holds the ad's Copy block; `audience` is the warm segment it targets.

import type { RetargetingAd } from "./types";

export const RETARGETING_ADS: RetargetingAd[] = [
  {
    id: "rt-visited-sales-page",
    audience: "Visited sales page, no checkout",
    hook: "You saw Pocket Agent. Here is the simple version.",
    script:
      "Pocket Agent is the AI Agent Workspace for owner-led businesses. Business Brain gives your AI memory. Personas give it roles. Apps give it tools. Mission Control keeps you in control. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Build My AI Team",
    campaign: "retargeting",
    category: "mechanism",
  },
  {
    id: "rt-watched-vsl",
    audience: "Watched VSL, no pricing click",
    hook: "Do not overcomplicate the first setup.",
    script:
      "Your first goal is 3-3-3 activation: 3 Business Brain assets. 3 trained Personas. 3 working workflows. Start with Business Agent at $97/month and get the AI Office Launch Kit included free.",
    cta: "Start Business Agent",
    campaign: "retargeting",
    category: "pricing",
  },
  {
    id: "rt-pricing-click",
    audience: "Pricing click, no purchase",
    hook: "Most owner-led businesses should start with Business Agent.",
    script:
      "Business Agent is $97/month. You get Business Brain, Personas, Apps, Mission Control, 20 Skills, the Launch Kit, and Launchpad access. Start there. Upgrade when your agents need more execution.",
    cta: "Build My AI Team",
    campaign: "retargeting",
    category: "pricing",
  },
  {
    id: "rt-idea-engine-click",
    audience: "Idea Engine click, no purchase",
    hook: "Your idea should not die in Notes.",
    script:
      "Idea Engine validates your idea, plans the version that should ship, builds it, gets a sales page live, and lines up the first 25 prospects. Other tools give you prompts. Pocket Agent gives you a working website you can share.",
    cta: "Unlock AI Agent Workspace",
    campaign: "retargeting",
    category: "idea-engine",
  },
  {
    id: "rt-lead-scout-click",
    audience: "Lead Scout click, no purchase",
    hook: "Still need prospects?",
    script:
      "Lead Scout gives your Lead Researcher vertical-specific prospecting. Roofing. HVAC. Painting. General Contracting. Med Spa. Law Firm. Dentist. Pick a vertical. Review prospects in Mission Control. Prepare outreach with your Follow-Up Agent.",
    cta: "Run Lead Scout",
    campaign: "retargeting",
    category: "lead-scout",
  },
  {
    id: "rt-checkout-abandoner",
    audience: "Checkout abandoner",
    hook: "You were one step away from building your AI team.",
    script:
      "Start Pocket Agent and get the AI Office Launch Kit included free. Business Brain Setup Checklist. 3 starter Personas. 5 workflow templates. 7-Day Setup Plan. Pocket Agent Launchpad. Implementation Guarantee. Finish your setup.",
    cta: "Finish Checkout",
    campaign: "retargeting",
    category: "launch-kit",
  },
  {
    id: "rt-webinar-no-show",
    audience: "Webinar registered, no show",
    hook: "You missed the training.",
    script:
      "The replay is available. Watch how Pocket Agent helps owner-led businesses build a Business Brain, clone Personas, use Apps, and review everything in Mission Control. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Watch Replay",
    campaign: "retargeting",
    category: "webinar",
  },
  {
    id: "rt-replay-watcher",
    audience: "Replay watcher, no purchase",
    hook: "You watched the system. Now install the first loop.",
    script:
      "Start with 3-3-3 activation. 3 Business Brain assets. 3 trained Personas. 3 working workflows. Business Agent is the main starting point at $97/month.",
    cta: "Start Pocket Agent",
    campaign: "retargeting",
    category: "pricing",
  },
  {
    id: "rt-pilot-visitor",
    audience: "Pilot page visitor, no purchase",
    hook: "Not ready to subscribe? Start smaller.",
    script:
      "The 14-Day Pilot is $97 one-time. Business Brain starter. 1 Persona. 1 workflow. 1 Mission Control review. Your $97 credits toward your subscription if you upgrade within 30 days.",
    cta: "Start My 14-Day Pilot",
    campaign: "retargeting",
    category: "pilot",
  },
  {
    id: "rt-launchpad-skool",
    audience: "Launchpad / Skool angle",
    hook: "The software is only useful if you install it.",
    script:
      "That is why paid Pocket Agent subscriptions include the Pocket Agent Launchpad. Follow the 7-Day Setup Plan. Join implementation labs. Post wins. Hit 3-3-3 activation. Build your AI team without becoming technical.",
    cta: "Build My AI Team",
    campaign: "retargeting",
    category: "launch-kit",
  },
];
