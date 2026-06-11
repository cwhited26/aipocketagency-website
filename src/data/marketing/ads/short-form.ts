// 30 short-form video ads — Part 6C. Copy filed byte-for-byte (GPT-Hormozi
// voice). Format: 0-3s hook / 3-20s problem / 20-45s mechanism / 45-60s CTA.

import type { Ad } from "./types";

export const SHORT_FORM_ADS: Ad[] = [
  {
    id: "generic-ai-starts-from-zero",
    hook: "Generic AI starts from zero every time.",
    script:
      "You explain the business. The offer. The customer. The voice. The context. The last conversation. The next step. Then tomorrow, you do it again. That is not leverage. That is a smart intern with amnesia. Pocket Agent starts from your business. It gives you a Business Brain, clone-and-customize Personas, workflow Apps, and Mission Control. Your Business Brain is your company memory. Your Personas are the roles. Your Apps are the tools. Mission Control is where you approve the work. Stop starting from zero. Build your AI team inside Pocket Agent.",
    cta: "Build My AI Team",
    campaign: "cold-vsl",
    category: "mechanism",
  },
  {
    id: "ai-agents-are-too-hard",
    hook: "Everyone says you need AI agents. Nobody shows you how to actually set them up.",
    script:
      "Business owners are being told: Use AI agents. Automate your business. Replace repetitive work. Use AI for sales, admin, content, follow-up, and operations. Cool. How? APIs? Zapier? Prompt chains? Consultants? Random tools duct-taped together? Most business owners do not want that. Pocket Agent gives you a simpler path. Business Brain. Personas. Apps. Mission Control. Clone the role. Add your context. Use the workflow. Review the output. That is how you build your AI team without becoming technical.",
    cta: "Save My Seat",
    campaign: "cold-webinar",
    category: "mechanism",
  },
  {
    id: "smart-intern-with-amnesia",
    hook: "ChatGPT is a smart intern with amnesia.",
    script:
      "It can write. It can summarize. It can brainstorm. But it does not know your business unless you explain it again. And again. And again. Pocket Agent fixes that. Your Business Brain stores your company memory in markdown inside your own git repo. Then your Personas use that context inside workflow Apps. Email Drafter. Follow-Up Sweeps. Lead Scout. Capture Inbox. Idea Engine. Mission Control. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Build My AI Team",
    campaign: "cold-vsl",
    category: "mechanism",
  },
  {
    id: "admin-team-without-hiring",
    hook: "Need an admin team but not ready to hire one?",
    script:
      "If you are an owner-led business, too much still depends on you. Emails. Follow-ups. Client notes. Content ideas. Lead research. Daily priorities. Operations. Approvals. Pocket Agent helps you build trained AI Personas for the roles your business needs. Admin Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher. Operations Chief of Staff. Each Persona uses Apps to prepare work. You review everything in Mission Control. AI does the prep. You stay in control.",
    cta: "Start Building My AI Team",
    campaign: "cold-vsl",
    category: "personas",
  },
  {
    id: "business-context-is-scattered",
    hook: "Your business knowledge is probably everywhere except where your AI can use it.",
    script:
      "Emails. Docs. Screenshots. Notes. Prompts. Calls. Links. Videos. Customer conversations. Your head. That is why AI still feels like work. The context is scattered. Pocket Agent gives your business a Business Brain. Your company memory in markdown, stored in your own git repo. Then your AI Personas use that context to draft, research, capture, build, and prepare work. Stop feeding context into blank boxes. Build your Business Brain.",
    cta: "Build My Business Brain",
    campaign: "cold-vsl",
    category: "business-brain",
  },
  {
    id: "mission-control",
    hook: "AI is only useful if you know what it is doing.",
    script:
      "Business owners should not let AI run wild. No random emails. No unapproved pages. No decisions you never reviewed. That is why Pocket Agent has Mission Control. See what was captured. Review drafts. Approve follow-ups. Check lead research. Monitor Idea Engine outputs. Review landing pages. AI does the prep. You stay in control. Pocket Agent is the AI Agent Workspace for owner-led businesses.",
    cta: "See Mission Control",
    campaign: "cold-vsl",
    category: "mission-control",
  },
  {
    id: "follow-up-agent",
    hook: "Most businesses do not need more leads until they fix follow-up.",
    script:
      "Leads do not usually disappear because the offer is bad. They disappear because nobody followed up. The message got buried. The quote sat. The proposal never got chased. The owner got busy. Pocket Agent gives you a Follow-Up Agent. It can use Follow-Up Sweeps to find stalled conversations and prepare the next touch. You review in Mission Control. You approve what goes out. That is how AI should work.",
    cta: "Build My Follow-Up Agent",
    campaign: "cold-vsl",
    category: "follow-up",
  },
  {
    id: "email-drafter",
    hook: "You are not slow at email because you cannot write.",
    script:
      "You are slow because you have to remember the context. What did they ask? What happened last time? What is the tone? What is the next step? What should you not say? Pocket Agent's Email Drafter uses your Business Brain to prepare replies in your voice. Then you review in Mission Control. Not generic email. Business-context email. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Start Pocket Agent",
    campaign: "cold-vsl",
    category: "email",
  },
  {
    id: "capture-inbox",
    hook: "Your best ideas are dying in Notes.",
    script:
      "You hear something on a podcast. You save a YouTube video. You take a screenshot. You record a voice memo. You think of a new offer in the shower. Then nothing happens. Pocket Agent gives you Capture Inbox. Capture the raw idea. Let your Content Creator process it. Review the output in Mission Control. Turn ideas into assets instead of letting them rot.",
    cta: "Open Capture Inbox",
    campaign: "cold-vsl",
    category: "capture",
  },
  {
    id: "idea-engine-shower-idea",
    hook: "What if your shower idea became a live website before your coffee got cold?",
    script:
      "Drop an idea into Pocket Agent. A voice memo. A podcast insight. A rough thought. A customer problem. Idea Engine validates whether real people would buy it, plans the version that should ship, builds it, gets a sales page live, and lines up the first 25 prospects to email. Other tools give you prompts. Pocket Agent gives you a working website you can share.",
    cta: "See Idea Engine",
    campaign: "idea-engine",
    category: "idea-engine",
  },
  {
    id: "idea-engine-other-tools-give-prompts",
    hook: "Other AI tools give you a blueprint. Then you still have to do everything.",
    script:
      "That is the problem. You get a plan. You get prompts. You get a checklist. Then you still have to validate it. Write the page. Build the page. Publish the page. Find prospects. Write outreach. Pocket Agent's Idea Engine ends with a working website you can share. Idea. Validation. Plan. Sales page. First 25 prospects. That is different.",
    cta: "Unlock AI Agent Workspace",
    campaign: "idea-engine",
    category: "idea-engine",
  },
  {
    id: "paidcreators-anchor",
    hook: "PaidCreators charges $497 once for a Gameplan you still have to execute.",
    script:
      "Pocket Agent includes Idea Engine in AI Agent Workspace at $497/month. And Idea Engine actually ships the working website for you. It validates the idea. Plans what should ship. Builds the page. Gets it live. Lines up the first 25 prospects to email. One gives you homework. The other gives you an asset.",
    cta: "See Idea Engine",
    campaign: "idea-engine",
    category: "idea-engine",
  },
  {
    id: "lead-scout-random-leads",
    hook: "Stop asking AI for random leads.",
    script:
      "Random prompt equals random list. Lead Scout gives your Lead Researcher structure. Pick the vertical. Pick the location. Give it the offer. Review the prospects. Then use your Follow-Up Agent and Email Drafter to prepare outreach. Lead Scout includes vertical packs for Roofing, HVAC, Painting, General Contracting, Med Spa, Law Firm, and Dentist. Prospecting needs context. Pocket Agent gives it context.",
    cta: "Run Lead Scout",
    campaign: "lead-scout",
    category: "lead-scout",
  },
  {
    id: "lead-scout-vertical-packs",
    hook: "Selling to local businesses? Start with a vertical.",
    script:
      "A roofer is not a med spa. A dentist is not a law firm. An HVAC company is not a painter. Generic lead lists do not understand that. Pocket Agent's Lead Scout includes vertical packs for: Roofing. HVAC. Painting. General Contracting. Med Spa. Law Firm. Dentist. Your Lead Researcher uses Lead Scout. Your Follow-Up Agent prepares next touches. Mission Control keeps you in approval.",
    cta: "Build My Lead Research Agent",
    campaign: "lead-scout",
    category: "lead-scout",
  },
  {
    id: "business-brain-in-git",
    hook: "Your business memory should not be trapped in random chats.",
    script:
      "Pocket Agent's Business Brain is your company memory in markdown, stored in your own git repo. That means your business context is structured. Portable. Yours. Not buried in a random chat thread. Add your offers, FAQs, voice, customer notes, workflows, links, screenshots, and decisions. Then your Personas use that context to do work. That is how Pocket Agent starts from your business.",
    cta: "Build My Business Brain",
    campaign: "cold-vsl",
    category: "business-brain",
  },
  {
    id: "seven-personas",
    hook: "Your business does not need one generic AI assistant.",
    script:
      "It needs roles. Pocket Agent ships with 7 clone-and-customize Personas. Admin Assistant. Sales Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher. Operations Chief of Staff. Each role can use Apps to do work. A Persona is the WHO. An App is the WHAT. That is how you build an AI team without becoming technical.",
    cta: "Start Building My AI Team",
    campaign: "cold-vsl",
    category: "personas",
  },
  {
    id: "apps-not-chat",
    hook: "AI chat answers questions. Pocket Agent Apps move work forward.",
    script:
      "There is a difference. A chat box waits for a prompt. A workflow App gives the AI a job. Lead Scout finds prospects. Email Drafter drafts replies. Follow-Up Sweeps catches stalled conversations. Capture Inbox collects ideas. YouTube Ingester processes channels. Podcast Ingester processes shows. Idea Engine ships pages. Mission Control keeps you in control. That is an AI Agent Workspace.",
    cta: "See The Apps",
    campaign: "cold-vsl",
    category: "apps",
  },
  {
    id: "activation-3-3-3",
    hook: "Do not build 20 AI agents. Build this first.",
    script:
      "Your first milestone inside Pocket Agent is 3-3-3 activation. 3 Business Brain assets. 3 trained Personas. 3 working workflows. Start with: Your offer. Your voice. Your customer questions. Then clone: Admin Assistant. Follow-Up Agent. Content Creator. Then install: Email Drafting. Follow-Up Sweeps. Capture Inbox to Content. That is enough to make Pocket Agent real.",
    cta: "Get The Launch Kit",
    campaign: "cold-vsl",
    category: "launch-kit",
  },
  {
    id: "launch-kit",
    hook: "The biggest risk with AI software is not the tool. It is that you never set it up.",
    script:
      "That is why every paid Pocket Agent subscription includes the AI Office Launch Kit. Business Brain Setup Checklist. 3 starter Personas. 5 workflow templates. Mission Control Review Checklist. 7-Day Setup Plan. Pocket Agent Launchpad access. 30 prebuilt Skills. You are not buying another blank tool. You are getting the setup path.",
    cta: "Build My AI Team",
    campaign: "cold-vsl",
    category: "launch-kit",
  },
  {
    id: "implementation-guarantee",
    hook: "Here is the only guarantee we make.",
    script:
      "Complete the Launch Kit's 7-day setup steps. If you do not have 3 trained Personas and 3 working workflows inside Pocket Agent by day 7, we help you finish the setup. We do not guarantee revenue. That would be nonsense. We guarantee implementation. Because implementation is the real bottleneck. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Start Pocket Agent",
    campaign: "cold-vsl",
    category: "launch-kit",
  },
  {
    id: "fourteen-day-pilot",
    hook: "Not ready for another subscription? Start with the 14-Day Pilot.",
    script:
      "For $97 one-time, you get: Business Brain starter. 1 Persona. 1 workflow. 1 Mission Control review. 14-day access to the Pilot Track inside Pocket Agent Launchpad. If you upgrade within 30 days, your $97 credits toward your subscription. This is not a free trial. Free trials attract dabblers. Paid pilots attract operators. Build one useful loop. Then decide.",
    cta: "Start My 14-Day Pilot",
    campaign: "cold-vsl",
    category: "pilot",
  },
  {
    id: "business-agent-plan",
    hook: "Most owner-led businesses should start with Business Agent.",
    script:
      "Business Agent is $97/month. It gives you: Business Brain. Clone-and-customize Personas. Workflow Apps. Mission Control. 20 prebuilt Skills. AI Office Launch Kit. Pocket Agent Launchpad access. This is the main starting point if you want AI agents doing real work inside your business. Start here. Stack from there.",
    cta: "Build My AI Team",
    campaign: "cold-vsl",
    category: "pricing",
  },
  {
    id: "ai-agent-workspace-plan",
    hook: "If you want the full cockpit, this is the tier.",
    script:
      "AI Agent Workspace is $497/month. It includes: Idea Engine. Lead Scout vertical packs. Decision Roundtable. Full cockpit. All 30 Skills. Advanced Mission Control. This is for businesses that want more than memory and basic workflows. It is for owners who want ideas turned into live assets and prospects lined up.",
    cta: "Unlock AI Agent Workspace",
    campaign: "idea-engine",
    category: "pricing",
  },
  {
    id: "skool-launchpad",
    hook: "Software gives you the workspace. The Launchpad helps you install it.",
    script:
      "Every paid Pocket Agent subscription includes access to the Pocket Agent Launchpad on Skool. Not a random community. An implementation hub. 7-Day Setup Plan. Business Brain walkthroughs. Persona examples. Workflow training. Mission Control reviews. Idea Engine examples. Lead Scout demos. Weekly implementation labs. Your first goal: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
    cta: "Join The Launchpad",
    campaign: "cold-vsl",
    category: "launch-kit",
  },
  {
    id: "coaches-consultants",
    hook: "Coaches and consultants do not need more random AI prompts.",
    script:
      "You need content. Emails. Lead follow-up. Sales call prep. Landing pages. Offer ideas. Client notes. Pocket Agent gives you an AI Agent Workspace trained on your business. Business Brain stores your context. Personas do the roles. Apps move work forward. Mission Control keeps you in approval. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Build My AI Team",
    campaign: "cold-vsl",
    category: "audience",
  },
  {
    id: "agencies",
    hook: "Agency context is scattered everywhere.",
    script:
      "Client notes. Briefs. Research. Competitor links. Landing pages. Reports. Content drafts. Follow-ups. Internal decisions. Pocket Agent helps agencies build a Business Brain, clone Personas, use Apps, and review everything in Mission Control. Your Content Creator can process inputs. Your Lead Researcher can run Lead Scout. Your Operations Chief of Staff can organize work. Stop rebuilding context in every AI chat.",
    cta: "Build My Agency Workspace",
    campaign: "cold-vsl",
    category: "audience",
  },
  {
    id: "service-businesses",
    hook: "Service businesses lose money in follow-up.",
    script:
      "Quotes sit. Emails get buried. Jobs need notes. Customers ask the same questions. Leads go cold. The owner remembers everything. Pocket Agent helps service businesses build trained AI Personas for admin, follow-up, email, lead research, and operations. AI does the prep. You stay in control.",
    cta: "Build My Follow-Up System",
    campaign: "cold-vsl",
    category: "audience",
  },
  {
    id: "med-spa-lead-scout",
    hook: "If you sell to med spas, generic lead lists are not enough.",
    script:
      "Med spas have different offers. Different language. Different buyer triggers. Different website signals. Pocket Agent's Lead Scout has a Med Spa vertical pack. Your Lead Researcher can find prospects. Your Follow-Up Agent can prepare next touches. Mission Control keeps you in review. Stop asking AI for random leads. Give it a vertical.",
    cta: "Run Med Spa Lead Scout",
    campaign: "lead-scout",
    category: "lead-scout",
  },
  {
    id: "law-firm-lead-scout",
    hook: "Law firm outreach needs context.",
    script:
      "You cannot treat law firms like every other local business. The vertical matters. Pocket Agent's Lead Scout includes a Law Firm vertical pack. Your Lead Researcher can find prospects. Your Email Drafter can prepare outreach. Your Mission Control keeps everything under review. Generic AI starts from zero. Pocket Agent starts from your business.",
    cta: "Run Law Firm Lead Scout",
    campaign: "lead-scout",
    category: "lead-scout",
  },
  {
    id: "dentist-lead-scout",
    hook: "Want to sell into dental practices?",
    script:
      "Do not use random AI lead lists. Use Lead Scout with the Dentist vertical pack. Your Lead Researcher can find prospects. Your Follow-Up Agent can prepare outreach. Mission Control keeps you in control. Pocket Agent is the AI Agent Workspace for owner-led businesses.",
    cta: "Run Dentist Lead Scout",
    campaign: "lead-scout",
    category: "lead-scout",
  },
];
