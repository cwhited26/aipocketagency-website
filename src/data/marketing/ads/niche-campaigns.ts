// 10 niche campaigns — Part 6G–6P. Copy filed byte-for-byte (GPT-Hormozi
// voice). The first three niches (6G–6I) carry the full positioning block;
// Roofing (6J) carries everything except Main Pain; the remaining six
// Lead-Scout verticals (6K–6P) ship only the landing-page hero + ad in the
// source, so their optional positioning fields are omitted — no invented copy.

import type { NicheCampaign } from "./types";

export const NICHE_CAMPAIGNS: NicheCampaign[] = [
  {
    id: "coaches-and-consultants",
    niche: "Coaches and Consultants",
    positioning: "Pocket Agent for coaches and consultants.",
    core_promise:
      "Turn your ideas, offers, calls, podcasts, videos, and client questions into content, follow-up, landing pages, and sales assets.",
    main_pain:
      "Coaches and consultants have too many ideas and not enough execution. They need: Content. Emails. Landing pages. Sales follow-up. Call prep. Offer notes. Client context. Podcast and YouTube ingestion. Idea validation.",
    best_personas: [
      "Content Creator",
      "Follow-Up Agent",
      "Email Drafter",
      "Sales Assistant",
      "Operations Chief of Staff",
    ],
    best_apps: [
      "Capture Inbox",
      "Email Drafter",
      "Follow-Up Sweeps",
      "YouTube Ingester",
      "Podcast Ingester",
      "Landing Page Builder",
      "Idea Engine",
      "Mission Control",
    ],
    landing_page_hero: {
      headline:
        "Build your AI content and follow-up team without becoming technical.",
      subheadline:
        "Pocket Agent helps coaches and consultants turn scattered business context into trained AI Personas for content, email, follow-up, landing pages, client notes, and idea execution.",
      cta: "Build My AI Team",
    },
    ad: {
      hook: "Coaches and consultants do not need more AI prompts.",
      script:
        "You need a system that turns your ideas into assets. Client questions. Podcast ideas. Voice memos. YouTube notes. Sales call objections. Old emails. Offer ideas. Pocket Agent gives you a Business Brain, Content Creator, Email Drafter, Follow-Up Agent, and Apps like Capture Inbox, Podcast Ingester, YouTube Ingester, Landing Page Builder, and Idea Engine. Generic AI starts from zero. Pocket Agent starts from your business.",
      cta: "Build My AI Content Team",
    },
  },
  {
    id: "agencies",
    niche: "Agencies",
    positioning: "Pocket Agent for agencies.",
    core_promise:
      "Organize client context, research, content, proposals, landing pages, and follow-up in one AI Agent Workspace.",
    main_pain:
      "Agencies are drowning in context. Client notes. Briefs. Assets. Competitor links. Content drafts. Proposals. Reporting. Follow-up. Internal decisions.",
    best_personas: [
      "Operations Chief of Staff",
      "Content Creator",
      "Lead Researcher",
      "Email Drafter",
      "Sales Assistant",
    ],
    best_apps: [
      "Business Brain",
      "Capture Inbox",
      "Lead Scout",
      "Landing Page Builder",
      "YouTube Ingester",
      "Podcast Ingester",
      "Brain Map",
      "Mission Control",
      "Idea Engine",
    ],
    landing_page_hero: {
      headline: "Build an AI Agent Workspace for your agency.",
      subheadline:
        "Pocket Agent helps agencies organize client context, clone AI Personas, use workflow Apps, and review work in Mission Control — so research, content, proposals, and follow-up stop living in scattered tools.",
      cta: "Build My Agency Workspace",
    },
    ad: {
      hook: "Your agency context is scattered. Your AI output shows it.",
      script:
        "Client notes in one place. Briefs in another. Competitor links in Slack. Content ideas in Docs. Reports in spreadsheets. Follow-ups in inboxes. Then you ask generic AI to help and wonder why the output feels shallow. Pocket Agent gives your agency a Business Brain, Personas, Apps, and Mission Control. Your Content Creator can draft. Your Lead Researcher can research. Your Operations Chief of Staff can organize. Everything comes back for review.",
      cta: "Build My Agency Workspace",
    },
  },
  {
    id: "service-businesses",
    niche: "Service Businesses",
    positioning: "Pocket Agent for service businesses.",
    core_promise:
      "Build an AI admin and follow-up workspace for quotes, emails, customer questions, job notes, and lead research.",
    main_pain:
      "Service businesses lose revenue in admin and follow-up. Quotes sit. Leads go cold. Emails get buried. Jobs need notes. Customers ask repeat questions. The owner remembers everything.",
    best_personas: [
      "Admin Assistant",
      "Follow-Up Agent",
      "Email Drafter",
      "Lead Researcher",
      "Operations Chief of Staff",
    ],
    best_apps: [
      "Email Drafter",
      "Follow-Up Sweeps",
      "Capture Inbox",
      "Lead Scout",
      "Mission Control",
      "Brain Map",
    ],
    landing_page_hero: {
      headline: "Build your AI admin and follow-up team without hiring.",
      subheadline:
        "Pocket Agent helps service business owners draft emails, follow up with leads, organize job context, research prospects, and review work in Mission Control.",
      cta: "Build My AI Admin Team",
    },
    ad: {
      hook: "Service businesses do not just need more leads. They need better follow-up.",
      script:
        "A lead asks for a quote. You get busy. The message gets buried. The quote sits. The follow-up never happens. That is money leaking. Pocket Agent gives you a Follow-Up Agent, Email Drafter, Lead Researcher, and Mission Control. AI prepares the work. You approve what goes out. Stop letting follow-up live in your head.",
      cta: "Build My Follow-Up System",
    },
  },
  {
    id: "roofing",
    niche: "Roofing",
    positioning:
      "Pocket Agent for roofing marketers and roofing service businesses.",
    core_promise:
      "Use Lead Scout's Roofing vertical pack to find prospects, prepare outreach, and keep follow-up moving.",
    best_personas: [
      "Lead Researcher",
      "Follow-Up Agent",
      "Email Drafter",
      "Operations Chief of Staff",
    ],
    best_apps: [
      "Lead Scout",
      "Email Drafter",
      "Follow-Up Sweeps",
      "Mission Control",
    ],
    landing_page_hero: {
      headline: "Find roofing prospects without generic AI lead lists.",
      subheadline:
        "Pocket Agent's Lead Scout Roofing pack helps your Lead Researcher find prospects, prepare context, and move outreach into Mission Control for review.",
      cta: "Run Roofing Lead Scout",
    },
    ad: {
      hook: "Selling to roofers? Stop asking AI for random local leads.",
      script:
        "Roofing is its own vertical. The websites look different. The offers are different. The buying triggers are different. Pocket Agent's Lead Scout includes a Roofing vertical pack. Your Lead Researcher finds prospects. Your Email Drafter prepares outreach. Your Follow-Up Agent prepares next touches. Mission Control keeps everything under review.",
      cta: "Run Roofing Lead Scout",
    },
  },
  {
    id: "hvac",
    niche: "HVAC",
    landing_page_hero: {
      headline:
        "Build an AI lead research and follow-up system for HVAC prospects.",
      subheadline:
        "Use Pocket Agent's HVAC Lead Scout pack to research prospects, prepare outreach, and review follow-up inside Mission Control.",
      cta: "Run HVAC Lead Scout",
    },
    ad: {
      hook: "HVAC prospects are not generic local leads.",
      script:
        "If you sell into HVAC, you need vertical context. Pocket Agent's Lead Scout includes an HVAC pack. Your Lead Researcher can find prospects. Your Follow-Up Agent can prepare next touches. Your Email Drafter can draft outreach. You review everything in Mission Control. Generic AI starts from zero. Pocket Agent starts from your business.",
      cta: "Run HVAC Lead Scout",
    },
  },
  {
    id: "painting",
    niche: "Painting",
    landing_page_hero: {
      headline:
        "Find painting business prospects with a vertical-specific AI workflow.",
      subheadline:
        "Pocket Agent's Painting Lead Scout pack gives your Lead Researcher the structure to find prospects and prepare outreach for review.",
      cta: "Run Painting Lead Scout",
    },
    ad: {
      hook: "Painting businesses need follow-up too.",
      script:
        "If you sell marketing, software, operations, or services to painting companies, do not start with random lead lists. Start with Lead Scout's Painting vertical pack. Find prospects. Review in Mission Control. Draft outreach. Prepare follow-up. Pocket Agent gives your AI agents the workspace to do it.",
      cta: "Run Painting Lead Scout",
    },
  },
  {
    id: "general-contracting",
    niche: "General Contracting",
    landing_page_hero: {
      headline: "Build an AI prospecting system for general contractors.",
      subheadline:
        "Use Lead Scout's General Contracting vertical pack to find prospects, prepare context, draft outreach, and review everything in Mission Control.",
      cta: "Run General Contractor Lead Scout",
    },
    ad: {
      hook: 'General contractors are not "random local businesses."',
      script:
        "They have specific jobs. Specific pain. Specific follow-up needs. Specific website signals. Pocket Agent's Lead Scout includes a General Contracting vertical pack. Your Lead Researcher finds prospects. Your Email Drafter drafts outreach. Your Follow-Up Agent prepares next steps. Mission Control keeps you in control.",
      cta: "Run General Contractor Lead Scout",
    },
  },
  {
    id: "med-spa",
    niche: "Med Spa",
    landing_page_hero: {
      headline: "Find med spa prospects with AI that understands the vertical.",
      subheadline:
        "Pocket Agent's Med Spa Lead Scout pack helps your Lead Researcher find prospects, review opportunities, and prepare outreach from one AI Agent Workspace.",
      cta: "Run Med Spa Lead Scout",
    },
    ad: {
      hook: "Med spas lose money when leads do not get followed up.",
      script:
        "Med spa leads are expensive. If follow-up is slow, money leaks. If you sell to med spas, your outreach needs vertical context. Pocket Agent's Lead Scout includes a Med Spa pack. Find prospects. Review their context. Prepare outreach. Use Follow-Up Agent to draft next touches. Review everything in Mission Control.",
      cta: "Run Med Spa Lead Scout",
    },
  },
  {
    id: "law-firm",
    niche: "Law Firm",
    landing_page_hero: {
      headline: "Build an AI lead research workflow for law firm prospects.",
      subheadline:
        "Pocket Agent's Law Firm Lead Scout pack helps your Lead Researcher find prospects, prepare context, and review outreach inside Mission Control.",
      cta: "Run Law Firm Lead Scout",
    },
    ad: {
      hook: "Law firm outreach needs context.",
      script:
        "You cannot treat law firms like generic local businesses. Practice area matters. Website positioning matters. Lead capture matters. Follow-up matters. Pocket Agent's Lead Scout includes a Law Firm vertical pack. Your Lead Researcher finds prospects. Your Email Drafter prepares outreach. Your Mission Control keeps the work under review.",
      cta: "Run Law Firm Lead Scout",
    },
  },
  {
    id: "dentist",
    niche: "Dentist",
    landing_page_hero: {
      headline:
        "Find dental practice prospects with a vertical-specific AI workflow.",
      subheadline:
        "Use Pocket Agent's Dentist Lead Scout pack to find prospects, prepare outreach, and keep follow-up moving from Mission Control.",
      cta: "Run Dentist Lead Scout",
    },
    ad: {
      hook: "Selling to dental practices? Stop using generic AI prospecting.",
      script:
        "Dental practices have specific needs. Patient acquisition. Reviews. Follow-up. Website conversion. Local visibility. Pocket Agent's Lead Scout includes a Dentist vertical pack. Your Lead Researcher finds prospects. Your Follow-Up Agent prepares next touches. Your Email Drafter drafts outreach. You approve everything in Mission Control.",
      cta: "Run Dentist Lead Scout",
    },
  },
];
