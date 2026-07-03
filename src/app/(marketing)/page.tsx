import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";

const DESCRIPTION =
  "Sales, marketing, content, customer support, research — every AI Agent everyone else is selling you separately. Pocket Agent packages all of them into one workspace. No coding. No scary tech. $37 a month.";

const OG_TITLE = "Every AI Agent your business needs. Packaged.";

export const metadata: Metadata = {
  title: "Pocket Agent — Every AI Agent Your Business Needs. Packaged.",
  description: DESCRIPTION,
  metadataBase: new URL("https://aipocketagent.com"),
  alternates: { canonical: "https://aipocketagent.com" },
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    url: "https://aipocketagent.com",
    siteName: "Pocket Agent",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent — every AI Agent your business needs, packaged",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
  },
};

// The ten Packaged AI Agents. Locked naming: every agent is "[Role] AI Agent" — the full
// phrase every time, to defuse the "AI Agent" jargon by repeating it in a plain business
// context. `madeOf` is the "want the detail?" reveal: the Persona + Apps + Skills that make
// up each agent (the architecture, revealed — not hidden).
const PACKAGED_AGENTS: { name: string; body: string; madeOf: string }[] = [
  {
    name: "Sales AI Agent",
    body: "Prospects your ideal customers, drafts outreach in your voice, follows up on every lead until they answer, books calls straight to your calendar.",
    madeOf:
      "Sales Persona · Apps: Lead Scout, Email Drafter, Follow-Up Sweeps · Skills: cold-email sequence in your voice, objection handling, book-the-call close.",
  },
  {
    name: "Sales Manager AI Agent",
    body: "Reviews your pipeline daily, tells you which deals need attention, drafts coaching notes for your reps, forecasts the month.",
    madeOf:
      "Sales Manager Persona · Apps: Pipeline Review, Decision Roundtable · Skills: deal-risk read, rep coaching notes, month-end forecast.",
  },
  {
    name: "Marketing AI Agent",
    body: "Builds landing pages, drafts email campaigns, writes ads, monitors what’s working.",
    madeOf:
      "Marketing Persona · Apps: Landing Page Builder, Email Drafter · Skills: landing-page copy in your voice, ad angles, campaign sequencing.",
  },
  {
    name: "Content AI Agent",
    body: "Writes blog posts, newsletters, social captions, and video scripts. Ingests podcasts and YouTube for ideas. Publishes in your voice.",
    madeOf:
      "Content Persona · Apps: Podcast Ingester, YouTube Ingester, Landing Page Builder · Skills: blog draft in your voice, newsletter, case study from a call transcript.",
  },
  {
    name: "Customer Support AI Agent",
    body: "Answers inbound customer emails, remembers every past conversation, escalates the ones that need you.",
    madeOf:
      "Support Persona · Apps: Email Drafter, Capture Inbox · Skills: tone-matched reply, remember-the-thread, escalation triage.",
  },
  {
    name: "Research AI Agent",
    body: "Pulls intel on prospects before your calls, monitors what competitors are doing, writes market briefs.",
    madeOf:
      "Research Persona · Apps: Lead Scout, Competitor Watch · Skills: pre-call prospect brief, competitor scan, market brief.",
  },
  {
    name: "Admin AI Agent",
    body: "Captures every idea, voice memo, screenshot, and forwarded email. Files them where you’ll find them. Runs your daily brief.",
    madeOf:
      "Admin Persona · Apps: Capture Inbox, Daily Brief · Skills: inbox triage, idea filing, end-of-day brief.",
  },
  {
    name: "Operations AI Agent",
    body: "Runs your Decision Roundtable on big calls, approves what needs approval, oversees what the other agents are doing, tracks every dollar of AI spend.",
    madeOf:
      "Operations Persona · Apps: Decision Roundtable, Mission Control · Skills: three-option framing, approval routing, spend tracking.",
  },
  {
    name: "Idea AI Agent",
    body: "You bring an idea. It builds you a working website, a signup form, a database, and puts it live.",
    madeOf:
      "Builder Persona · Apps: Idea Engine, Landing Page Builder, Build Tools · Skills: validate the idea, ship the first version, line up the first prospects.",
  },
  {
    name: "Voice AI Agent",
    body: "Answers your phone. Handles inbound sales calls, qualifies leads, schedules meetings.",
    madeOf:
      "Voice Persona · Apps: Voice Calls · Skills: inbound qualify, book the meeting, log the call.",
  },
];

// The tier-gated setup ask. Never scare a $37 buyer with three accounts they don't need —
// each tier sees only its own setup unless it expands. Personal Brain is open by default.
const SETUP_TIERS: { name: string; price: string; body: string; open?: boolean }[] = [
  {
    name: "Personal Brain",
    price: "$37",
    open: true,
    body: "To start, you set up one free account: GitHub. That’s where your business context lives — the notes, the memory, your voice, your customers. Signing up takes about a minute, about as easy as making a Facebook account, and Pocket Agent walks you through every step.",
  },
  {
    name: "Business Agent",
    price: "$97",
    body: "You also set up Vercel and Supabase — both free, both about a minute each. Vercel is where your Marketing AI Agent puts landing pages up so people can see them. Supabase is where your Customer Support AI Agent remembers every conversation. Pocket Agent walks you through both, no technical knowledge required.",
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    body: "No new accounts on top of the three at $97. Just more agents doing more work. Your Idea AI Agent uses all three to build full working websites from an idea. Your Voice AI Agent uses your existing Vercel and Supabase to run your phone.",
  },
];

const APPS: { name: string; body: string; badge?: { label: string; href: string } }[] = [
  {
    name: "Email Drafter",
    body: "Drafts replies and outreach in your voice, staged for one-tap approval. Forward an email from anywhere and get back a reply written the way you’d write it.",
  },
  {
    name: "Lead Scout",
    body: "Sweeps Google Maps (including the “no website” filter), sorts every prospect, and drafts personalized outreach per lead. Seven vertical packs: roofing, HVAC, painting, general contracting, med spa, law firm, dentist.",
  },
  {
    name: "Capture Inbox",
    body: "Catch an idea, a note, a screenshot, a voice memo, a saved link — anywhere, any time. Your agent files it into your Business Brain so it’s there when you need it instead of lost in a notes app.",
  },
  {
    name: "Podcast Ingester",
    body: "Drop a podcast link; your agent listens to the episode, pulls what matters, and files it in your Business Brain. Watch a show and it ingests every new episode on its own.",
  },
  {
    name: "YouTube Ingester",
    body: "Drop a video link on any door; your agent reads the transcript, sorts it, and routes the signal to your Business Brain. Watch a channel and it does it for every upload.",
  },
  {
    name: "Decision Roundtable",
    body: "For the calls that matter — pricing, hiring, scope — three of your agents argue the question from different angles and hand you a written verdict you edit before it saves.",
  },
  {
    name: "Build Tools",
    body: "Tell your agent what to build — a CRM, a portal, a dashboard — and it builds it on your own accounts (your GitHub, your Vercel, your Supabase). The code is yours.",
  },
  {
    name: "Follow-Up Sweeps",
    body: "Finds every conversation that went quiet — a quote with no reply, a lead that ghosted — and drafts the next touch in your voice, staged for one tap. The follow-up you always mean to do.",
  },
  {
    name: "Landing Page Builder",
    body: "Pick a template from the gallery — a phone-first trades page, a booking-led med spa, a luxury listing site — and PA writes the copy in your voice and builds the page on your own accounts. You approve every step, and the code is yours.",
    badge: { label: `Powered by ${DIRECTION_COUNTS.total} distinct templates →`, href: "/templates" },
  },
];

const DAY: { time: string; body: string }[] = [
  {
    time: "6:45am",
    body: "Dana opens her phone over coffee. Her Admin AI Agent has triaged 23 overnight emails. Three replies are drafted in her voice — a follow-up to a hot lead, a scope clarification for a client, a quote for a new prospect. She reviews them in four minutes and taps Approve on each.",
  },
  {
    time: "10:00am",
    body: "A competitor’s new pricing page goes live. Dana forwards the link to her agent. By her 11am call, the competitor’s positioning is in her Business Brain — pricing, packaging, the three things they push. Next sales call, that intel is already in the brain her agent reads from.",
  },
  {
    time: "12:00pm",
    body: "A lead came in through her website over lunch. Her Sales AI Agent already drafted the proposal using her pricing rules and her voice. She changes one sentence and taps Send.",
  },
  {
    time: "3:00pm",
    body: "Dana drops a voice memo: “idea for a coaches’ onboarding tool.” By dinner her market scan is done, the first version is staged, and she’s approved it going live. By 9pm she has a working page at a real URL she’s sharing with her test audience.",
  },
  {
    time: "6:00pm",
    body: "Dana’s at her son’s soccer game. A client texts to reschedule. She forwards the text to her agent. By halftime, the reply is drafted with three times pulled from her calendar.",
  },
  {
    time: "9:00pm",
    body: "Dana opens Mission Control. She sees the day — 47 actions taken, 12 staged for approval, $3.47 of spend. She set a $50 monthly cap. No surprise bill coming.",
  },
];

const SKILL_GROUPS: { group: string; skills: string }[] = [
  {
    group: "Voice + Style",
    skills:
      "Write like you. Lead with the action. Don’t be a chatbot. Honest hedging. Specific over generic.",
  },
  {
    group: "Email Drafting",
    skills:
      "Cold intro structure. Quote follow-up. Customer-reply tone-match. Subject lines that don’t get filtered. Boundary-setting decline.",
  },
  {
    group: "Sales",
    skills:
      "Lead qualification. Objection handling. Discovery-call notes. Proposal drafting. Stack-the-deck close.",
  },
  {
    group: "Research",
    skills:
      "Competitor pricing extract. Customer-voice extract. Tactic extraction. Vertical landscape scan. Source verification.",
  },
  {
    group: "Operations",
    skills:
      "Inbox triage. Project scaffolding. Quote drafting from notes. Vendor invoice categorization. End-of-day reflection.",
  },
  {
    group: "Decision-shape",
    skills:
      "Three-option framing. Load-bearing assumption. Devil’s-advocate first pass. Reversibility check. Pre-mortem.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this just another chatbot?",
    a: "No. A chatbot waits for a prompt. Pocket Agent gives your business memory (your Business Brain), workers (your AI Agents, called Personas), the tools they use (Apps), and an approval screen (Mission Control). The agents do the work using your context. You review and approve.",
  },
  {
    q: "Is Pocket Agent replacing ChatGPT?",
    a: "Not exactly. ChatGPT is a blank box. Pocket Agent is a workspace that already knows your business. You can still use other AI tools — but this is the place your business memory, your AI Agents, their workflows, and your approvals all live.",
  },
  {
    q: "Where does my data live?",
    a: "In your own GitHub — a free account you set up in under a minute, walked through step by step. Your Business Brain is a folder of plain text files you can download any time. Cancel and you keep everything. There’s no hidden database holding your business hostage.",
  },
  {
    q: "Do I have to be technical?",
    a: "No. The AI Office Launch Kit walks you through setup — nothing to code, nothing to plug in. The Pocket Agent Launchpad on Skool gives you the 7-Day Setup Plan and walkthroughs. The Implementation Guarantee means if you’re not set up by day 7, we help you finish.",
  },
  {
    q: "What is an AI Agent, exactly?",
    a: "Inside Pocket Agent, an AI Agent is a worker called a Persona — your Sales AI Agent, your Content AI Agent. Each one uses Apps (like Email Drafter or Lead Scout) the way an employee uses software, and has Skills — specific moves it’s learned. You hand it work and approve what it brings back.",
  },
  {
    q: "Will AI send things without me?",
    a: "No. The whole product is review-first. Your agents prepare the work; nothing goes out until you approve it in Mission Control.",
  },
  {
    q: "Will I get a surprise bill?",
    a: "No. Your plan comes with usage allowances — leads, transcription hours, agent runs. Hit a cap and your agent prompts you to move up a tier. You don’t pay for AI usage by the token, and you can set a monthly budget your agent won’t cross without asking.",
  },
  {
    q: "Can I bring my own Anthropic key?",
    a: "Yes — on the AI Agent Workspace tier. When you bring your own key, you see real dollar usage, because then it’s your own AI spend.",
  },
  {
    q: "Can I cancel?",
    a: "Any time. You keep your Business Brain, your accounts, and everything your agents built. There’s no lock-in.",
  },
];

const PRICING_TIERS: {
  name: string;
  price: string;
  best: string;
  rows: { label: string; value: string }[];
  featured?: boolean;
  tier: string;
}[] = [
  {
    name: "Personal Brain",
    price: "$37",
    tier: "starter",
    best: "Your first Persona with the Apps and Skills to do real work.",
    rows: [
      { label: "AI Agents (Personas)", value: "1" },
      { label: "Prebuilt Skills", value: "5" },
      { label: "Lead Scout packs", value: "—" },
      { label: "Idea Engine", value: "—" },
    ],
  },
  {
    name: "Business Agent",
    price: "$97",
    tier: "pro",
    featured: true,
    best: "Clone-and-customize Personas + connected tools + the Apps you actually need.",
    rows: [
      { label: "AI Agents (Personas)", value: "Multiple" },
      { label: "Prebuilt Skills", value: "20" },
      { label: "Connected tools", value: "Gmail, Calendar, Slack, QuickBooks" },
      { label: "Idea Engine", value: "—" },
    ],
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    tier: "studio_plus",
    best: "Every Persona, every App, every Skill — 30 total. Idea Engine, Lead Scout vertical packs, Decision Roundtable, Voice Calls, the full stack.",
    rows: [
      { label: "AI Agents (Personas)", value: "Unlimited" },
      { label: "Prebuilt Skills", value: "30" },
      { label: "Lead Scout packs", value: "✓" },
      { label: "Idea Engine", value: "✓" },
      { label: "Layoutbook + Field Book premium gallery", value: "✓" },
    ],
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 inline-block text-xs text-cyan-300/70"
      style={{ fontFamily: MONO_FONT }}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-24 text-center sm:pt-32">
            <Pill>[ AI Agent Workspace · for owner-led businesses ]</Pill>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              All the AI agents your business will ever need. Packaged. Ready to
              deploy.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Every business owner is hearing they need AI agents. Everyone’s
              selling them one at a time. Pocket Agent is all of them, packaged and
              ready to go — even if you know nothing about AI or computers. We did
              all the connecting. You just tell it about your business. It becomes
              your second brain. Your Packaged AI Agents do the rest. $37 a month.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=pro" label="Start for $37" />
              <SecondaryCTA href="/pricing" label="See how it works" />
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Generic AI starts from zero. Pocket Agent starts from your business.
            </p>
          </div>
        </section>

        {/* SOFTENING — strip the scariness before the list (Chase correction 4). */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Agents aren’t a technology. They’re workers.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Every AI Agent inside Pocket Agent does what a hire would do — the
                sales calls, the follow-ups, the writing, the research, the
                customer replies. You already know how to work with people. Same
                rules apply here.
              </p>
              <p className="text-slate-100">
                Nothing to plug in. Nothing to code. Nothing scary. We did the
                connecting for you. You just link a few free accounts and Pocket
                Agent walks you through every step.
              </p>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="border-b border-white/5 bg-black/30">
          <div className="mx-auto max-w-4xl px-6 py-8 text-center text-sm leading-relaxed text-slate-400">
            Built and run inside three businesses Chase Whited owns:{" "}
            <span className="text-slate-200">Tennessee Valley Exteriors</span> (a
            contracting company) ·{" "}
            <span className="text-slate-200">Whited Consulting</span> (a software
            agency) · <span className="text-slate-200">AthleteOS</span> (a sports
            SaaS). Same workspace. Same brain. Same cockpit.
          </div>
        </section>

        {/* THE TEN PACKAGED AI AGENTS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Your Packaged AI Agents.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              The workers everyone else sells you one at a time — packaged
              together, already knowing your business. Each one is a Persona with
              its Apps and Skills built in.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PACKAGED_AGENTS.map((a) => (
                <div
                  key={a.name}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-base font-semibold text-slate-100">
                    {a.name}
                  </h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate-400">
                    {a.body}
                  </p>
                  <details className="mt-4">
                    <summary
                      className="cursor-pointer list-none text-xs text-cyan-300/70 transition hover:text-cyan-300"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      What it’s made of →
                    </summary>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                      {a.madeOf}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SHORTCUT — what the subscription actually buys: the 12-month AI learning curve compressed. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                You&rsquo;re not buying software. You&rsquo;re skipping a year.
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-300">
                <p>
                  To build what Pocket Agent hands you on day one, you&rsquo;d
                  spend twelve months learning Claude, GitHub, prompt engineering,
                  agent orchestration, memory design, and how to wire all of it
                  together. We already did that work.
                </p>
                <p>
                  Your subscription is the shortcut past a year of AI learning.
                  Pocket Agent hands you the trained workers on day one — Sales,
                  Marketing, Content, Customer Support, all ten of them — already
                  configured, already connected, already reading your business.
                </p>
                <p className="font-semibold text-slate-100">
                  That&rsquo;s what the subscription buys: a working AI team, not a codebase.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* OWNERSHIP — demystify the free tools, tie them to what the agents build. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                You own everything your Packaged AI Agents build.
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-300">
                <p>
                  Pocket Agent uses three free tools to build things for you —{" "}
                  <span className="text-slate-100">GitHub</span>,{" "}
                  <span className="text-slate-100">Vercel</span>, and{" "}
                  <span className="text-slate-100">Supabase</span>. Each takes about
                  a minute to sign up for, about as easy as making a Facebook
                  account, and Pocket Agent walks you through every step. Every
                  website your Personas launch, every workflow your Apps run, every
                  memory your Skills save — it all lives inside accounts you own.
                </p>
                <p>
                  Cancel Pocket Agent tomorrow. Your website stays live. Your brain —
                  every note, every customer, every decision — stays in your own
                  GitHub. Every email your agents already sent, every landing page
                  they already built, every workflow they ran — all of it stays.
                </p>
                <p>
                  The agents themselves need Pocket Agent to keep running. But you
                  keep everything they made, and you can pick up where you left off
                  the day you come back.
                </p>
                <p className="font-semibold text-slate-100">
                  No walled garden. No hostage data. That’s the difference between
                  Pocket Agent and every other AI product out there.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT AN AI AGENT IS — the architecture, revealed as the answer. */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Here’s what an AI Agent looks like inside Pocket Agent.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              Your Packaged AI Agents live inside Pocket Agent — they’re called
              Personas, and each one comes with Apps and Skills built in.
            </p>
            <div className="mx-auto mt-8 max-w-3xl space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                In Pocket Agent, an AI agent is called a{" "}
                <span className="text-slate-100">Persona</span>. Your Sales AI
                Agent. Your Content AI Agent. Your Ops AI Agent. Each Persona uses{" "}
                <span className="text-slate-100">Apps</span> — Email Drafter, Lead
                Scout, Follow-Up Sweeps, Podcast Ingester, Landing Page Builder —
                the same way an employee uses software. And each Persona has{" "}
                <span className="text-slate-100">Skills</span> — specific moves
                they’ve learned to do, like “draft a cold-email sequence in your
                voice” or “write a case study from a call transcript.”
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {[
                {
                  k: "Personas",
                  h: "the workers",
                  b: "A Persona is a worker you put to a job: your Sales AI Agent, your Admin AI Agent, your Content AI Agent. Each one has a role and knows which part of your business to read from. You hand it work the way you’d hand something to a person on a team — except you’re not managing anyone.",
                },
                {
                  k: "Apps",
                  h: "the tools they use",
                  b: "An App is a tool a Persona runs: Email Drafter, Lead Scout, Capture Inbox, Follow-Up Sweeps, Landing Page Builder, Idea Engine. A Persona with Apps can do real work. You don’t operate the Apps — the Persona does. You just see the result.",
                },
                {
                  k: "Skills",
                  h: "the moves they’ve learned",
                  b: "A Skill is a specific move an agent knows: a cold-email sequence in your voice, an objection-handling pass, a case study from a call transcript. Pocket Agent ships with a library already loaded, and your agents write new ones back as they work.",
                },
                {
                  k: "Business Brain",
                  h: "what they all know",
                  b: "The memory every Persona reads from: your voice, your customers, your prices, your processes, your decisions. It’s the part generic AI keeps forgetting. Every finished job writes back to it, so it gets sharper every week — and it’s yours to keep.",
                },
              ].map((p) => (
                <div
                  key={p.k}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
                >
                  <h3 className="text-xl font-semibold text-slate-100">
                    {p.k}
                    <span className="ml-2 text-sm font-normal text-cyan-300/80">
                      — {p.h}
                    </span>
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
                    {p.b}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECOND BRAIN */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ tell it about your business once ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your Business Brain is the second brain.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Every Persona reads from your Business Brain — a folder of plain
                text files in your own GitHub with your voice, your customers, your
                prices, your decisions. Tell it about your business once. That’s the
                second brain.
              </p>
              <p>
                Add your offers, services, customers, documents, screenshots, saved
                links, emails, notes, workflows, brand voice, style examples,
                project details, and your do-not-say list. Most AI tools forget all
                of it. The agents in Pocket Agent don’t feel generic because they
                already know your business.
              </p>
            </div>
          </div>
        </section>

        {/* MISSION CONTROL */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ the cockpit ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Every move your agents make, on one screen.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Business owners don’t want AI running wild. Good — that fear is
                rational. You shouldn’t have random emails going out, pages going
                live, or AI making decisions without you seeing the work.
              </p>
              <p>
                So every action — every email drafted, every lead pulled, every
                dollar of AI spend — flows through Mission Control. One screen.
                Every move visible. You approve what matters. Set a monthly budget
                and your agent pauses and asks before it crosses the cap.
              </p>
            </div>
          </div>
        </section>

        {/* PAYOFF — close the mechanism. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <p className="text-balance text-xl font-semibold leading-relaxed text-slate-100 sm:text-2xl">
              That’s the box. Personas + Apps + Skills + Business Brain + Mission
              Control. Everything wired together, running on your business, deployed
              to your own GitHub. $37 a month.
            </p>
          </div>
        </section>

        {/* SETUP — tier-gated, expand-to-see. */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What you set up — and it’s not much.
            </h2>
            <p className="mt-4 text-slate-400">
              The free accounts your agents use to build and remember things. You
              only set up what your plan actually needs. Open the plan you’re on.
            </p>
            <div className="mt-8 space-y-4">
              {SETUP_TIERS.map((t) => (
                <details
                  key={t.name}
                  open={t.open}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="text-base font-semibold text-slate-100">
                      {t.name}
                    </span>
                    <span className="text-sm font-semibold text-cyan-300">
                      {t.price}/mo
                    </span>
                  </summary>
                  <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                    {t.body}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* APPS — the toolkit your agents use. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the Apps your agents use ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The tools inside every agent.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              You don’t have to touch any of it. Your agents use these to do the
              work; you review what they bring back.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {APPS.map((a) => (
                <div
                  key={a.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-base font-semibold text-slate-100">
                    {a.name}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                    {a.body}
                  </p>
                  {a.badge && (
                    <Link
                      href={a.badge.href}
                      className="mt-3 inline-block text-xs text-cyan-300/70 transition hover:text-cyan-300"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {a.badge.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* IDEA ENGINE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ the heavy hitter · Idea AI Agent ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Turn an idea into a real thing on the internet.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p className="text-slate-100">
                Drop an idea — a voice memo, a podcast you just listened to, a
                thought you had in the shower. Your Idea AI Agent checks whether real
                people would buy it, plans the version that should actually ship,
                builds it for you, gets a sales page live, and lines up the first 25
                prospects to email. By the time you finish your morning coffee, your
                idea is a real thing on the internet you can show people.
              </p>
              <p>
                Most owners don’t have an idea problem. They have a follow-through
                problem. They hear a podcast idea, save a YouTube tactic, get a
                thought in the shower. They think, “that could be something.” Then
                nothing happens.
              </p>
              <p>
                Other tools hand you a blueprint and a stack of prompts you go run
                somewhere else. The Idea AI Agent ends with a working website you can
                share.
              </p>
            </div>
            <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
              <p className="text-[15px] leading-relaxed text-slate-300">
                <span className="text-slate-100">The honest comparison:</span>{" "}
                PaidCreators charges $497 once for a Gameplan you still have to go run
                somewhere else. Pocket Agent includes the Idea AI Agent in your AI
                Agent Workspace at $497/month — and it actually ships the working
                website for you.
              </p>
            </div>
          </div>
        </section>

        {/* LEAD SCOUT */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ find the first prospects ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find the first prospects worth talking to.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Lead research gets messy fast when AI is too generic. Lead Scout
                gives your Research AI Agent structure. Start with a vertical. Choose
                the market. Review the prospects. Then your Sales AI Agent drafts the
                next touch in your voice.
              </p>
              <p>
                Seven vertical packs: roofing, HVAC, painting, general contracting,
                med spa, law firm, dentist. Find prospects, prepare the context, and
                move outreach into Mission Control for review.
              </p>
            </div>
          </div>
        </section>

        {/* DAY IN THE WORKSPACE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A day with your Packaged AI Agents.
            </h2>
            <p className="mt-4 text-slate-400">
              The clearest way to see it is one day. This is a composite drawn from
              real owners using it, with the name changed. Meet Dana. She owns a
              three-person agency. Before Pocket Agent, her day started at 6:30am
              with email triage and ended at 10pm with the next day’s prep. Now:
            </p>
            <div className="mt-10 space-y-6">
              {DAY.map((d) => (
                <div key={d.time} className="flex gap-5">
                  <div
                    className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-cyan-300/90"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {d.time}
                  </div>
                  <p className="flex-1 text-[15px] leading-relaxed text-slate-300">
                    {d.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-lg leading-relaxed text-slate-300">
              She’s logged off by 9:30. She didn’t open Gmail, QuickBooks, or her
              CRM all day. She talked to customers, ran two sales calls, and watched
              her kid play soccer.{" "}
              <span className="text-slate-100">
                That’s the workspace. It runs the work. You run the business.
              </span>
            </p>
          </div>
        </section>

        {/* SKOOL LAUNCHPAD */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ included · Pocket Agent Launchpad ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Software gives you the workspace. The Launchpad helps you install it.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Most people don’t fail with AI because the tool is bad. They fail
                because they never set it up. That’s why every paid Pocket Agent
                subscription includes the Pocket Agent Launchpad on Skool — the
                guided setup hub, not a random community.
              </p>
              <p>
                Inside, you follow the 7-Day Setup Plan, watch the walkthroughs,
                post your wins, join the setup labs, and see how other owner-led
                businesses run Pocket Agent. The goal is simple: get your first 3 AI
                Agents and 3 workflows working as fast as possible.
              </p>
            </div>
          </div>
        </section>

        {/* LAUNCH KIT BONUS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 sm:p-10">
              <Pill>[ free with every subscription ]</Pill>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                The AI Office Launch Kit.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                The biggest risk isn’t that AI won’t work. The risk is that you
                won’t set it up. So every paid subscription includes the AI Office
                Launch Kit — the fastest path from “I bought AI software” to “I have
                AI Agents doing real work,” in your first week.
              </p>
              <ul className="mt-6 grid gap-3 text-[15px] text-slate-300 sm:grid-cols-2">
                {[
                  "Business Brain Setup Checklist",
                  "3 starter AI Agents — Admin, Follow-Up, Content",
                  "5 starter workflow templates",
                  "Mission Control Review Checklist",
                  "The 7-Day Setup Plan",
                  "Pocket Agent Launchpad access on Skool",
                  "30 prebuilt Skills auto-loaded into your brain",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 text-cyan-300">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-slate-400">
                You’re not buying another app and wondering what to do next. You’re
                starting with a setup path.
              </p>
              <div className="mt-6">
                <Link
                  href="/launch-kit"
                  className="text-sm font-semibold text-cyan-300 transition hover:underline"
                >
                  What’s in the Launch Kit →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 30 SKILLS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the Skills already loaded ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Every agent starts with Skills already loaded.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Skills are the specific moves your agents use to write, draft,
              research, sell, operate, and decide better. You’re not starting from a
              blank prompt library.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SKILL_GROUPS.map((s) => (
                <div
                  key={s.group}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-base font-semibold text-slate-100">
                    {s.group}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
                    {s.skills}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500">
              Personal Brain includes 5 Skills. Business Agent includes 20. AI Agent
              Workspace includes all 30. As your agents run more work, they write
              new Skills back to your brain — so they get sharper every week.
            </p>
          </div>
        </section>

        {/* USAGE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Flat monthly bill. Clear usage allowances. No surprise bills.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Each plan comes with usage allowances — leads, transcription hours,
                and agent runs. Hit a cap, move up a tier. You don’t pay for AI
                usage by the token, and you don’t get a surprise bill.
              </p>
              <p className="text-sm text-slate-500">
                One exception: AI Agent Workspace owners who bring their own
                Anthropic key see real dollar usage, because that’s their own AI
                spend.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Choose the plan your business needs now.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
              Start simple. Move up when your agents need to do more. Every plan
              includes the AI Office Launch Kit, free.
            </p>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PRICING_TIERS.map((t) => (
                <div
                  key={t.name}
                  className={`flex flex-col rounded-2xl border p-7 ${
                    t.featured
                      ? "border-cyan-300/40 bg-cyan-300/[0.05]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {t.featured ? (
                    <div
                      className="mb-3 inline-block w-fit rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-medium text-cyan-300"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      most popular
                    </div>
                  ) : null}
                  <h3 className="text-lg font-semibold text-slate-100">
                    {t.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-100">
                      {t.price}
                    </span>
                    <span className="text-sm text-slate-500">/mo</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{t.best}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-400">
                    {t.rows.map((r) => (
                      <li
                        key={r.label}
                        className="flex items-center justify-between gap-2 border-b border-white/5 pb-2"
                      >
                        <span className="text-slate-500">{r.label}</span>
                        <span className="text-right text-slate-300">
                          {r.value}
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-slate-500">AI Office Launch Kit</span>
                      <span className="text-cyan-300">✓</span>
                    </li>
                  </ul>
                  <Link
                    href={`/start?tier=${t.tier}`}
                    className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
                      t.featured
                        ? "bg-accent text-accent-foreground"
                        : "border border-accent/50 bg-accent/[0.04] text-accent hover:bg-accent/[0.08]"
                    }`}
                  >
                    Start
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              Most owners land on Business Agent. The AI Agent Workspace tier is the
              full stack — it’s the value anchor.{" "}
              <Link href="/pricing" className="text-cyan-300 hover:underline">
                See all plans
              </Link>{" "}
              for Pro+ and Studio in between.
            </p>
          </div>
        </section>

        {/* IMPLEMENTATION GUARANTEE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                The Pocket Agent Implementation Guarantee.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                Complete the Launch Kit’s 7-day setup steps. If you don’t have 3
                trained AI Agents and 3 working workflows inside Pocket Agent by day
                7, we help you finish the setup.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
                That’s the only guarantee. We don’t guarantee revenue. We guarantee
                setup — because getting set up is the real bottleneck.
              </p>
            </div>
          </div>
        </section>

        {/* WHY THIS EXISTS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why this exists.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Pocket Agent was built by Chase Whited, who runs three businesses: a
                contracting company, a software agency, and a sports SaaS. He built
                it because he was spending three hours a night on email and wanted
                his evenings back without firing someone.
              </p>
              <p>
                He runs all three on it. Same workspace, same brain, same cockpit.
                Nothing on this page promises something that isn’t shipped. If you
                can do it on the screenshot, you can do it in your account.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Questions.
            </h2>
            <div className="mt-10 divide-y divide-white/5">
              {FAQ.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="text-base font-semibold text-slate-100">
                    {f.q}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section>
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Every AI Agent your business needs. Packaged.
            </h2>
            <p className="mt-5 text-lg text-slate-300">
              All of them, connected for you, running on your own business context,
              in accounts you own. Cancel anytime and it all keeps running. $37 a
              month.
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryCTA href="/start?tier=pro" label="Start for $37" />
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Generic AI starts from zero. Pocket Agent starts from your business.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
