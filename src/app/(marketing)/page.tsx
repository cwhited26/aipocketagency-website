import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";

const DESCRIPTION =
  "Every AI agent everyone else is selling you, all in one workspace. Sign up, connect a free GitHub, deploy to your own Vercel + Supabase. $37 a month. Yours to keep.";

const OG_TITLE =
  "Everyone's selling AI agents one at a time. Pocket Agent is the whole team, in one box.";

export const metadata: Metadata = {
  title: "Pocket Agent — AI Agents in a Box for Business Owners",
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
        alt: "Pocket Agent — AI agents in a box for business owners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
  },
};

const PERSONAS: { name: string; body: string }[] = [
  {
    name: "Admin Assistant",
    body: "Triages your inbox, drafts replies in your voice, logs invoices, schedules follow-ups, keeps your customer notes current. The hat most owners want off their head first.",
  },
  {
    name: "Sales Assistant",
    body: "Prepares sales notes, organizes opportunities, drafts the outreach in your voice, and keeps the pipeline moving. The growth work that never gets the time it needs.",
  },
  {
    name: "Content Creator",
    body: "Turns what you already know into content — pulls the tactics out of a podcast or a YouTube video you drop in, drafts the post or the page in your voice, builds the landing page on your own account.",
  },
];

const APPS: { name: string; body: string; badge?: { label: string; href: string } }[] = [
  {
    name: "Email Drafter",
    body: "Drafts replies and outreach in your voice, staged for one-tap approval. Forward an email from anywhere and get back a reply written the way you’d write it.",
  },
  {
    name: "Lead Scout",
    body: "Sweeps Google Maps (including the “no website” filter), classifies every prospect, and drafts personalized outreach per lead. Seven vertical packs: roofing, HVAC, painting, general contracting, med spa, law firm, dentist.",
  },
  {
    name: "Capture Inbox",
    body: "Catch an idea, a note, a screenshot, a voice memo, a saved link — anywhere, any time. Your agent files it into your brain so it’s there when you need it instead of lost in a notes app.",
  },
  {
    name: "Podcast Ingester",
    body: "Drop a podcast link; your agent listens to the episode, pulls what matters, and files it in your brain. Watch a show and it ingests every new episode on its own.",
  },
  {
    name: "YouTube Ingester",
    body: "Drop a video link on any door; your agent reads the transcript, classifies it, and routes the signal to your brain. Watch a channel and it does it for every upload.",
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
    body: "Dana opens her phone over coffee. Her Admin Assistant has triaged 23 overnight emails. Three replies are drafted in her voice — a follow-up to a hot lead, a scope clarification for a client, a quote for a new prospect. She reviews them in four minutes and taps Approve on each.",
  },
  {
    time: "10:00am",
    body: "A competitor’s new pricing page goes live. Dana forwards the link to her agent. By her 11am call, the competitor’s positioning is in her brain — pricing, packaging, the three things they push. Next sales call, that intel is already in the brain her agent reads from.",
  },
  {
    time: "12:00pm",
    body: "A lead came in through her website over lunch. Her Sales Assistant already drafted the proposal using her pricing rules and her voice. She changes one sentence and taps Send.",
  },
  {
    time: "3:00pm",
    body: "Dana drops a voice memo: “idea for a coaches’ onboarding tool.” By dinner her market scan is done, the MVP plan is staged, and she’s approved the deploy. By 9pm she has a working page at a real URL she’s sharing with her test audience.",
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
    a: "No. A chatbot waits for a prompt. Pocket Agent gives your business memory (the Business Brain), roles (Personas), tools (Apps), and an approval screen (Mission Control). The agents do the prep using your context. You review and approve.",
  },
  {
    q: "Is Pocket Agent replacing ChatGPT?",
    a: "Not exactly. ChatGPT is a blank box. Pocket Agent is a workspace trained on your business. You can still use other AI tools — but this is the place your business memory, AI roles, workflows, and approvals live.",
  },
  {
    q: "Where does my data live?",
    a: "Your Business Brain is a folder of plain markdown files in your own git repo. You can download the whole thing any time. Cancel and you keep everything — there’s no proprietary database holding your business hostage.",
  },
  {
    q: "Do I have to be technical?",
    a: "No. The AI Office Launch Kit walks you through setup — no markdown, no terminal. The Pocket Agent Launchpad on Skool gives you the 7-Day Setup Plan and walkthroughs. The Implementation Guarantee means if you’re not set up by day 7, we help you finish.",
  },
  {
    q: "What’s the difference between a Persona and an App?",
    a: "A Persona is the WHO — your Sales Assistant. An App is the WHAT it uses — Lead Scout. You pick the worker; the worker uses the tools.",
  },
  {
    q: "Will AI send things without me?",
    a: "No. The whole product is review-first. Your agents prepare the work; nothing goes out until you approve it in Mission Control.",
  },
  {
    q: "Will I get a surprise bill?",
    a: "No. Your plan comes with usage allowances — leads, Whisper hours, sub-agent runs. Hit a cap and your agent prompts you to upgrade to the next tier. You don’t pay API tokens directly, and you can set a monthly budget your agent won’t cross without asking.",
  },
  {
    q: "Can I bring my own Anthropic key?",
    a: "Yes — on Studio+. When you bring your own key, you see real dollar usage, because then it’s your money.",
  },
  {
    q: "Is the Layoutbook + Field Book catalog included?",
    a: "The premium templates are, from Pro+ up. Pro+ includes the Field Book premium conversion templates; the AI Agent Workspace includes the full gallery — Layoutbook and Field Book, every premium direction. The public catalogs stay separate products; the premium sets ride along with your workspace.",
  },
  {
    q: "Can I cancel?",
    a: "Any time. You keep your brain. There’s no lock-in.",
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
    best: "Your first AI agent + the workspace they live in.",
    rows: [
      { label: "Personas", value: "1" },
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
    best: "Your whole AI team — sales, content, research, follow-up — all in one workspace.",
    rows: [
      { label: "Personas", value: "Multiple" },
      { label: "Prebuilt Skills", value: "20" },
      { label: "Connected tools", value: "Gmail, Calendar, Slack, QuickBooks" },
      { label: "Idea Engine", value: "—" },
    ],
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    tier: "studio_plus",
    best: "Every AI agent you’d hire separately. Idea Engine + Lead Scout + Decision Roundtable + Voice Calls + 30 skills, all yours.",
    rows: [
      { label: "Personas", value: "Unlimited" },
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
              Everyone’s selling AI agents one at a time. Pocket Agent is the whole
              team, in one box.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Sign up, connect a free GitHub, and every agent everyone else sells
              you separately is running on your own business context. $37 a month.
              Yours to keep.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=pro" label="Get My AI Team" />
              <SecondaryCTA href="/pricing" label="See how it works" />
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Generic AI starts from zero. Pocket Agent starts from your business.
            </p>
          </div>
        </section>

        {/* OWNERSHIP MOAT — above the fold, right below the hero CTA (PA-POS-16 §2.2). */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                You own the code.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                Every agent, every persona, every memory file is in your own
                GitHub, deployed to your Vercel, backed by your Supabase. All free
                tools you sign up for once and connect.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                Cancel Pocket Agent tomorrow and your whole workspace stays running.
                No walled garden. No hostage data.
              </p>
              <p className="mt-4 text-[15px] font-semibold leading-relaxed text-slate-100">
                That’s the difference from every other AI agent product on the
                market.
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
            SaaS). Same workspace. Same brain pattern. Same cockpit.
          </div>
        </section>

        {/* PROBLEM */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Generic AI still makes you do all the work.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                ChatGPT, Claude, and Gemini are powerful. But most of the time,
                they still start from a blank box.
              </p>
              <p>
                You still have to explain your business. Your offer. Your customer.
                Your tone. Your workflow. Your last conversation. Your follow-up
                process. Your next step. Then you copy the output somewhere else.
              </p>
              <p>
                You save an idea in another place. You forget a follow-up. You lose
                a screenshot. You never turn the podcast idea into content. You
                never ship the page. You never email the prospects. And tomorrow,
                you start over again.
              </p>
              <p className="text-xl font-semibold text-slate-100">
                That’s not an AI system. That’s generic AI chaos. Generic AI starts
                from zero. Pocket Agent starts from your business.
              </p>
            </div>
          </div>
        </section>

        {/* FOUR PARTS / MECHANISM */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              The Pocket Agent System.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              Four parts: Business Brain, Personas, Apps, Mission Control. Once you
              see them, you understand the whole product.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {[
                {
                  k: "Business Brain",
                  h: "what your agents know",
                  b: "Your company memory in markdown, stored in your own git repo: your voice, your customers, your prices, your processes, your decisions. It’s the memory generic AI doesn’t have. Every agent reads from it. Every finished job writes back to it. It gets sharper every week, and it’s yours — you can download the whole thing any time.",
                },
                {
                  k: "Personas",
                  h: "the WHO",
                  b: "A Persona is a worker you put to a job: an Admin Assistant, a Sales Assistant, a Content Creator. Each one has a role and knows which part of your brain to read. You pick the Persona the way you’d hand something to a person on a team — except you’re not managing anyone.",
                },
                {
                  k: "Apps",
                  h: "the WHAT",
                  b: "An App is a tool a Persona runs: Email Drafter, Lead Scout, Capture Inbox, Follow-Up Sweeps, Landing Page Builder, Idea Engine. A Persona without Apps is just another character in a chat window. A Persona with Apps can do work. You don’t operate the Apps — the Persona does. You just see the result.",
                },
                {
                  k: "Mission Control",
                  h: "where you watch it all",
                  b: "One screen shows every action your agents are taking right now, what’s staged for your approval, and every dollar of spend to the cent. Set a monthly budget; your agent pauses and asks before it crosses the cap. Most AI products are a black box. This is the opposite — you see everything, and nothing goes out without your tap.",
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
            <p className="mx-auto mt-10 max-w-3xl text-center text-lg leading-relaxed text-slate-300">
              A Persona is the role. An App is the tool. A Persona uses Apps. That
              simple structure is what turns AI from a blank chat box into a
              workspace your business can actually use.
            </p>
          </div>
        </section>

        {/* BUSINESS BRAIN */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ first — the memory ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              First, build your Business Brain.
            </h2>
            <p className="mt-4 text-slate-400">
              Your company memory in markdown, stored in your own git repo.
            </p>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Your Business Brain is where Pocket Agent learns how your company
                works. Add your offers, services, customers, documents,
                screenshots, saved links, past prompts, emails, notes, workflows,
                brand voice, style examples, customer questions, project details,
                decisions, and your do-not-say list.
              </p>
              <p>
                Most AI tools forget everything. Pocket Agent gives your business
                memory, so your AI doesn’t start from zero every time.
              </p>
            </div>
          </div>
        </section>

        {/* PERSONAS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the WHO ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Then put your AI agents to work.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Pocket Agent ships with 7 ready-made agents you clone and make your
              own: Admin Assistant, Sales Assistant, Follow-Up Agent, Content
              Creator, Email Drafter, Lead Researcher, Operations Chief of Staff.
              Start with the job that’s burying you. (Inside the app, we call these
              Personas.)
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PERSONAS.map((p) => (
                <div
                  key={p.name}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7"
                >
                  <h3 className="text-lg font-semibold text-slate-100">
                    {p.name}
                  </h3>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-400">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500">
              Each agent reads your Business Brain, so it sounds like you and knows
              your business from the first task. You can run more than one. They all
              report to the same cockpit.
            </p>
          </div>
        </section>

        {/* APPS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the WHAT ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your agents come with tools. This is what’s in the box.
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
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ the heavy hitter · AI Agent Workspace ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Turn an idea into a real thing on the internet.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p className="text-slate-100">
                Drop an idea — a voice memo, a podcast you just listened to, a
                thought you had in the shower. Pocket Agent validates whether real
                people would buy it, plans the version that should actually ship,
                builds it for you, gets a sales page live, and lines up the first 25
                prospects to email. By the time you finish your morning coffee, your
                idea is a real thing on the internet you can show people.
              </p>
              <p>
                Most owners don’t have an idea problem. They have an execution
                problem. They hear a podcast idea, save a YouTube tactic, get a
                thought in the shower. They think, “that could be something.” Then
                nothing happens.
              </p>
              <p>
                Other tools hand you a blueprint and a stack of prompts you go
                execute somewhere else. The Idea Engine ends with a working website
                you can share.
              </p>
            </div>
            <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
              <p className="text-[15px] leading-relaxed text-slate-300">
                <span className="text-slate-100">The honest comparison:</span>{" "}
                PaidCreators charges $497 once for a Gameplan you still have to go
                execute somewhere else. Pocket Agent includes Idea Engine in your AI
                Agent Workspace at $497/month — and it actually ships the working
                website for you.
              </p>
            </div>
          </div>
        </section>

        {/* LEAD SCOUT */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ find the first prospects ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find the first prospects worth talking to.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Lead research gets messy fast when AI is too generic. Lead Scout
                gives your Lead Researcher structure. Start with a vertical. Choose
                the market. Review the prospects. Then use your Follow-Up Agent and
                Email Drafter to prepare the next touch.
              </p>
              <p>
                Seven vertical packs: roofing, HVAC, painting, general contracting,
                med spa, law firm, dentist. Find prospects, prepare the context, and
                move outreach into Mission Control for review.
              </p>
            </div>
          </div>
        </section>

        {/* MISSION CONTROL */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ the cockpit ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI does the prep. You stay in control.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Business owners don’t want AI running wild. Good — that fear is
                rational. You shouldn’t have random emails going out, unapproved
                pages published, or AI making decisions without you seeing the work.
              </p>
              <p>
                That’s why Pocket Agent includes Mission Control. Inside, you review
                what was captured, what was drafted, what was researched, what was
                queued, what was built, what needs approval, and what should happen
                next. AI does the prep. You stay in control.
              </p>
            </div>
          </div>
        </section>

        {/* DAY IN THE WORKSPACE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A day in the workspace.
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
                guided implementation hub, not a random community.
              </p>
              <p>
                Inside, you follow the 7-Day Setup Plan, watch the walkthroughs,
                post your wins, join the implementation labs, and see how other
                owner-led businesses run Pocket Agent. The goal is simple: get your
                first 3 Personas and 3 workflows working as fast as possible.
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
                AI Personas doing real work,” in your first week.
              </p>
              <ul className="mt-6 grid gap-3 text-[15px] text-slate-300 sm:grid-cols-2">
                {[
                  "Business Brain Setup Checklist",
                  "3 starter Personas — Admin, Follow-Up, Content",
                  "5 starter workflow templates",
                  "Mission Control Review Checklist",
                  "The 7-Day Setup Plan",
                  "Pocket Agent Launchpad access on Skool",
                  "30 prebuilt Skills auto-seeded into your brain",
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
            <Pill>[ the HOW ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pocket Agent starts with Skills already loaded.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Skills are reusable techniques your agents use to write, draft,
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
                Each plan comes with usage allowances — leads, Whisper hours, and
                sub-agent runs. Hit a cap, upgrade to the next tier. You don’t pay
                API tokens directly, and you don’t get a surprise usage bill.
              </p>
              <p className="text-sm text-slate-500">
                One exception: Studio+ owners who bring their own Anthropic key see
                real dollar usage, because that’s their own LLM spend.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Choose the workspace your business needs now.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
              Start simple. Upgrade when your agents need more usage, more
              workflows, and more execution. Every plan includes the AI Office
              Launch Kit, free.
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
              full cockpit — it’s the value anchor.{" "}
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
                trained Personas and 3 working workflows inside Pocket Agent by day
                7, we help you finish the setup.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
                That’s the only guarantee. We don’t guarantee revenue. We guarantee
                implementation — because implementation is the real bottleneck.
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
                He runs all three on it. Same workspace, same brain pattern, same
                cockpit. Nothing on this page promises something that isn’t shipped.
                If you can do it on the screenshot, you can do it in your account.
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
              Stop buying AI agents one at a time.
            </h2>
            <p className="mt-5 text-lg text-slate-300">
              Get the whole team in one box, running on your own business context,
              deployed to accounts you own. $37 a month. Yours to keep even if you
              cancel.
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryCTA href="/start?tier=pro" label="Get My AI Team" />
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
