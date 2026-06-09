import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";

const DESCRIPTION =
  "An AI Agent Workspace for owner-led businesses. Your agents already know your business — they read your inbox, find leads, draft in your voice, and build what you ask, while you watch every move and approve what matters. Generic AI starts from zero. Pocket Agent starts from your business.";

export const metadata: Metadata = {
  title: "Pocket Agent — build your AI Agent Workspace",
  description: DESCRIPTION,
  metadataBase: new URL("https://aipocketagent.com"),
  alternates: { canonical: "https://aipocketagent.com" },
  openGraph: {
    title: "Build your AI Agent Workspace without becoming an AI expert.",
    description: DESCRIPTION,
    url: "https://aipocketagent.com",
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Build your AI Agent Workspace without becoming an AI expert.",
    description: DESCRIPTION,
  },
};

const PERSONAS: { name: string; body: string; uses: string }[] = [
  {
    name: "Admin Assistant",
    body: "Triages your inbox, drafts replies in your voice, logs invoices, schedules follow-ups, keeps your customer notes current. The hat most owners want off their head first.",
    uses: "Email Drafter, Follow-Up Sweeps, your connected Gmail / Calendar / QuickBooks",
  },
  {
    name: "Sales Assistant",
    body: "Finds leads, classifies them, writes the outreach in your voice, and chases the follow-ups that go quiet. The growth work that never gets the time it needs.",
    uses: "Lead Scout, Email Drafter, Follow-Up Sweeps",
  },
  {
    name: "Content Creator",
    body: "Turns what you already know into content — pulls the tactics out of a podcast or a YouTube video you drop in, drafts the post or the page in your voice, builds the landing page on your own account.",
    uses: "YouTube Ingester, Podcast Ingester, Landing Page Builder",
  },
];

const APPS: { name: string; body: string; soon?: boolean }[] = [
  {
    name: "Email Drafter",
    body: "Drafts replies and outreach in your voice, staged for one-tap approval. Forward an email from anywhere and get back a reply written the way you’d write it.",
  },
  {
    name: "Lead Scout",
    body: "Sweeps Google Maps (including the “no website” filter), classifies every prospect, and drafts personalized outreach per lead. Seven vertical packs: roofing, HVAC, painting, general contracting, med spa, law firm, dentist. Replaces a $150/mo prospecting tool.",
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
    soon: true,
    body: "Finds every conversation that went quiet — a quote with no reply, a lead that ghosted — and drafts the next touch in your voice, staged for one tap. The follow-up you always mean to do.",
  },
  {
    name: "Landing Page Builder",
    soon: true,
    body: "Describe an offer; your Content Creator drafts the page in your voice and builds it live on your own Vercel. Approve the deploy. The page is yours.",
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
    body: "Dana types one line: “Find me 25 mid-sized SaaS companies hiring fractional marketing help in the Bay Area.” By 5pm, Lead Scout has the list — each one classified, each with a personalized cold email drafted in her voice. She taps Send on the eight she likes.",
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

const FAQ: { q: string; a: string }[] = [
  {
    q: "What’s an “AI Agent Workspace,” really?",
    a: "A place where AI agents do your business’s work because they already know your business. Four parts: a Business Brain (what they know), Personas (who works), Apps (what they use), and Mission Control (where you watch and approve). You set it up once; it gets sharper every week.",
  },
  {
    q: "Where does my data live?",
    a: "Your Business Brain is a folder of files in your own account. You can download the whole thing any time. Cancel and you keep everything — there’s no proprietary database holding your business hostage.",
  },
  {
    q: "Do I have to be technical?",
    a: "No. The AI Office Launch Kit walks you through setup with no markdown and no terminal. The Implementation Guarantee means if you get stuck in your first week, we help you finish.",
  },
  {
    q: "What’s the difference between a Persona and an App?",
    a: "A Persona is the worker — your Sales Assistant. An App is the tool it uses — Lead Scout. You pick the worker; the worker uses the tools.",
  },
  {
    q: "Will I get surprised by a bill?",
    a: "No. Mission Control shows every dollar to the cent. Set a monthly cap; your agent pauses and asks before it crosses 80% and stages new work for your approval at 100%.",
  },
  {
    q: "Can I reach it without opening the app?",
    a: "Yes. Text it, forward it an email, BCC it, Slack-DM it, share to it from your phone, or tap a home-screen Shortcut. Seven doors, one brain.",
  },
  {
    q: "Can my team use the same workspace?",
    a: "Yes, on the AI Agent Workspace tier.",
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
    best: "One owner, one inbox, getting started",
    rows: [
      { label: "Personas", value: "1" },
      { label: "Connected tools", value: "—" },
      { label: "Lead Scout packs", value: "—" },
      { label: "Decision Roundtable", value: "—" },
    ],
  },
  {
    name: "Business Agent",
    price: "$97",
    tier: "pro",
    featured: true,
    best: "A growing operator working across connected tools",
    rows: [
      { label: "Personas", value: "Multiple" },
      { label: "Connected tools", value: "Gmail, Calendar, Slack, QuickBooks" },
      { label: "Lead Scout packs", value: "—" },
      { label: "Decision Roundtable", value: "—" },
    ],
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    tier: "studio_plus",
    best: "The full operation — every Persona, every App",
    rows: [
      { label: "Personas", value: "Unlimited" },
      { label: "Connected tools", value: "All connectors" },
      { label: "Lead Scout packs", value: "✓" },
      { label: "Decision Roundtable", value: "✓" },
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
          <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-24 text-center sm:pt-32">
            <Pill>[ AI Agent Workspace · for owner-led businesses ]</Pill>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Build your AI Agent Workspace without becoming an AI expert.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              An AI Agent Workspace is a place where AI agents do the real work
              of your business — reading your inbox, finding leads, drafting in
              your voice, building what you ask for — because they already know
              your business instead of starting from a blank box every time.
              Pocket Agent gives you that workspace, and one screen to watch
              every move and approve what matters.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start at $37/mo" />
              <SecondaryCTA href="/pricing" label="See it run" />
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
              You wear too many hats.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                If you run an owner-led business, the work that grows the
                business — talking to customers, doing your craft, finding the
                next deal — keeps losing to the work that has to get done by
                tomorrow morning.
              </p>
              <p>
                Email triage. Customer replies. Quote drafts. Proposal writing.
                Invoice logging. Follow-up scheduling. Lead research. Content
                drafts. The list grows every week, and it all lands on you.
              </p>
              <p>
                You’ve tried AI for it. And here’s the wall: every AI tool
                starts from zero. New chat, blank box, blinking cursor. You
                re-explain your business, your prices, your voice — and the
                moment the chat closes, it forgets all of it. You’re using a
                tool that has to be re-briefed every single time.{" "}
                <span className="text-slate-100">That’s not help. That’s a second job.</span>
              </p>
              <p className="text-xl font-semibold text-slate-100">
                Generic AI starts from zero. Pocket Agent starts from your
                business.
              </p>
            </div>
          </div>
        </section>

        {/* FOUR PARTS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              The four parts of your workspace.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              Once you see them, you understand the whole product.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {[
                {
                  k: "Business Brain",
                  h: "what your agents know",
                  b: "Your brain is a folder of plain files in your own account: your voice, your customers, your prices, your processes, your decisions. It’s the memory generic AI doesn’t have. Every agent reads from it. Every finished job writes back to it. It gets sharper every week, and it’s yours — you can download the whole thing any time.",
                },
                {
                  k: "Personas",
                  h: "who does the work",
                  b: "A Persona is a worker you put to a job: an Admin Assistant, a Sales Assistant, a Content Creator. Each one has a role and knows which part of your brain to read. You pick the Persona the way you’d pick which person on a team to hand something to — except you’re not managing anyone.",
                },
                {
                  k: "Apps",
                  h: "what they use to do it",
                  b: "An App is a tool a Persona runs: Email Drafter, Lead Scout, Podcast Ingester, Follow-Up Sweeps, Landing Page Builder. Your Sales Assistant uses Lead Scout to find prospects and Email Drafter to write the outreach. You don’t operate the Apps — the Persona does. You just see the result.",
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
              Your <span className="text-slate-100">Business Brain</span> is what
              they know. <span className="text-slate-100">Personas</span> are who
              works. <span className="text-slate-100">Apps</span> are what they
              use. <span className="text-slate-100">Mission Control</span> is
              where you watch and approve. That’s the workspace.
            </p>
          </div>
        </section>

        {/* PERSONAS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the WHO ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pick the worker you need.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Start with the job that’s burying you. Pick the Persona that
              handles it.
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
                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    <span className="text-slate-400">Uses:</span> {p.uses}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500">
              Each Persona reads your Business Brain, so it sounds like you and
              knows your business from the first task. You can run more than one.
              They all report to the same cockpit.
            </p>
          </div>
        </section>

        {/* APPS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Pill>[ the WHAT ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The toolkit your Personas run.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              You don’t have to touch them — but this is what’s in the box.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {APPS.map((a) => (
                <div
                  key={a.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-100">
                      {a.name}
                    </h3>
                    {a.soon ? (
                      <span
                        className="rounded-full bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300"
                        style={{ fontFamily: MONO_FONT }}
                      >
                        we ship this week
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                    {a.body}
                  </p>
                </div>
              ))}
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
              The clearest way to see it is one day. This is a composite drawn
              from real owners using it, with the names changed. Meet Dana. She
              owns a three-person agency. Before Pocket Agent, her day started at
              6:30am with email triage and ended at 10pm with the next day’s
              prep. Now:
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
              CRM all day. She talked to customers, ran two sales calls, and
              watched her kid play soccer.{" "}
              <span className="text-slate-100">
                That’s the workspace. It runs the work. You run the business.
              </span>
            </p>
          </div>
        </section>

        {/* STOP TESTING */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-2xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stop testing random AI tools.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              You’ve tried the chatbots and the “AI assistant” apps. They all
              start from zero, and they all forget you the moment you close the
              tab. That’s why none of them stuck. Build your AI Agent Workspace:
              one brain that knows your business, workers that do the jobs, a
              cockpit that shows you every move. Set it up once and it gets
              sharper every week instead of starting over every session.
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryCTA href="/start?tier=starter" label="Start at $37/mo" />
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
                A workspace is only worth it if you actually get it set up. So
                every subscription includes the AI Office Launch Kit — a guided
                setup that takes you from empty workspace to working agents in
                your first week.
              </p>
              <ul className="mt-6 grid gap-3 text-[15px] text-slate-300 sm:grid-cols-2">
                {[
                  "Guided Business Brain setup — no markdown, no terminal",
                  "3 prebuilt Personas — Admin, Sales Follow-Up, Content",
                  "5 workflow templates — steal and run",
                  "The AI Office Setup Checklist",
                  "Your first Mission Control review",
                  "The Skool community — walkthroughs, live Q&A, help",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 text-cyan-300">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-slate-400">
                Total value if you bought these apart: well into four figures.
                Included with your subscription, free.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                <span className="text-slate-200">Implementation Guarantee:</span>{" "}
                complete the setup steps in your first 7 days, or we help you
                finish them. The only real risk with software like this is buying
                it and never getting it running. We took that risk off the table.
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

        {/* PRICING */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Three ways in.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
              Pick the one that fits where you are. Every plan includes the AI
              Office Launch Kit, free.
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
                      most pick this
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
              Most owners land on Business Agent. The AI Agent Workspace tier is
              the whole thing — it’s there so you can see the ceiling.{" "}
              <Link href="/pricing" className="text-cyan-300 hover:underline">
                See all plans
              </Link>{" "}
              for the steps in between.
            </p>
            <p className="mt-3 text-center text-sm text-slate-500">
              No “AI credits” to buy in packs. No surprise overages. Set a
              monthly budget; your agent pauses and asks before it crosses the
              cap.
            </p>
          </div>
        </section>

        {/* WHY THIS EXISTS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why this exists.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              <p>
                Pocket Agent was built by Chase Whited, who runs three
                businesses: a contracting company, a software agency, and a
                sports SaaS. He built it because he was spending three hours a
                night on email and wanted his evenings back without firing
                someone.
              </p>
              <p>
                He runs all three on it. Same workspace, same brain pattern, same
                cockpit. Nothing on this page promises something that isn’t
                shipped. If you can do it on the screenshot, you can do it in your
                account.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-white/5 bg-black/20">
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

        {/* FOOTER CTA */}
        <section>
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stop testing random AI tools. Build your AI Agent Workspace.
            </h2>
            <p className="mt-5 text-lg text-slate-300">
              $37/mo. Cancel any time. Your brain stays yours either way.
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryCTA href="/start?tier=starter" label="Start now" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
