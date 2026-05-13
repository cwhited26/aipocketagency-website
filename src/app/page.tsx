import Image from "next/image";
import Link from "next/link";

const TRIAL_URL = "https://app.aipocketagency.com/signup";
const BUILDOUT_URL = "https://buildoutstudios.com";
const SKOOL_URL = "https://www.skool.com/aipocketagency";

export default function Page() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <PainHooks />
      <Manifesto />
      <Ladder />
      <Origin />
      <HowItWorks />
      <Pricing />
      <ModulesShipping />
      <WhatItIsNot />
      <WhoItsFor />
      <FinalCTA />
      <Footer />
    </main>
  );
}

function PrimaryCTA({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <Link
      href={TRIAL_URL}
      className="group inline-flex flex-col items-center gap-1 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:flex-row sm:gap-3 sm:text-lg"
    >
      <span>{label}</span>
      {sublabel ? (
        <span className="text-xs font-medium uppercase tracking-wider text-accent-foreground/80 sm:text-sm">
          {sublabel}
        </span>
      ) : null}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="hidden h-5 w-5 transition group-hover:translate-x-1 sm:inline"
        fill="currentColor"
      >
        <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
      </svg>
    </Link>
  );
}

function SecondaryCTA({
  href,
  label,
  sublabel,
}: {
  href: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex flex-col items-center gap-1 rounded-full border border-accent/60 bg-accent/[0.04] px-8 py-4 text-base font-semibold text-accent shadow-[0_0_30px_-15px_rgba(34,211,238,0.6)] transition hover:scale-[1.02] hover:border-accent hover:bg-accent/[0.08] hover:shadow-[0_0_50px_-10px_rgba(34,211,238,0.7)] sm:flex-row sm:gap-3 sm:text-lg"
    >
      <span>{label}</span>
      {sublabel ? (
        <span className="text-xs font-medium uppercase tracking-wider text-accent/80 sm:text-sm">
          {sublabel}
        </span>
      ) : null}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="hidden h-5 w-5 transition group-hover:translate-x-1 sm:inline"
        fill="currentColor"
      >
        <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
      </svg>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
      style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      [ {children} ]
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-24 sm:pt-32 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div
            className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            [ pocket agent · $97/mo · 14-day free trial ]
          </div>
          <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Your AI forgets everything you told it.
            </span>
          </h1>
          <p className="mt-6 text-balance text-xl text-slate-200 sm:text-2xl">
            Pocket Agent gives it a brain that lives in your git repo.
          </p>
          <p className="mt-4 max-w-2xl text-balance text-lg text-slate-300 sm:text-xl">
            Sign up, connect GitHub, and every decision you&apos;ve ever made
            is searchable in three seconds. Your new agent drafts emails for
            you. Moves leads. Writes estimates when you don&apos;t have time.
            Nothing lives in the chat window anymore — it lives in your system.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 lg:items-start">
            <PrimaryCTA label="Start your 14-day free trial" sublabel="$97/mo after · cancel anytime" />
            <SecondaryCTA
              href="/dispatch-playbook"
              label="Start with a $15 kit"
              sublabel="instant download"
            />
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <Image
            src="/landing-hero.png"
            alt="Pocket Agent — the AI brain that runs from your pocket"
            width={1672}
            height={941}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full rounded-2xl shadow-xl ring-1 ring-white/10"
          />
        </div>
      </div>
    </section>
  );
}

function PainHooks() {
  const pains = [
    "My AI forgets everything I told it",
    "I re-explain my whole business every single conversation",
    "I know we made this decision — I can't find where",
    "Other tools cost a fortune and I don't own anything",
    "It can't help me past one chat window",
  ];
  return (
    <section className="border-b border-white/5 bg-black/40">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <SectionLabel>the wall</SectionLabel>
        <h2 className="text-2xl font-bold tracking-tight text-slate-200 sm:text-3xl">
          If you&apos;ve said any of these, you&apos;ve hit it.
        </h2>
        <ul className="mt-8 space-y-3">
          {pains.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-base leading-snug text-slate-300 sm:text-lg"
            >
              <span
                className="mt-0.5 shrink-0 text-xs text-slate-500"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                ×
              </span>
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">
          Pocket Agent solves all of it. One persistent brain — file-based,
          git-versioned, readable by every agent on the planet. You own it
          forever. No platform lock-in.
        </p>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.05] via-transparent to-transparent">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>manifesto</SectionLabel>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            This is the brain that runs my businesses.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
            You shouldn&apos;t have to choose between building real businesses
            and living your life. Pocket Agent is the operating system I built
            so I can run multiple software companies from a phone, from a job
            site, from a hotel, from anywhere. Persistent memory across every
            agent. The full why behind every what. Agent-agnostic,
            model-churn-resistant, and built so the work happens when it shows
            up — not when you&apos;re chained to a desk.
          </p>
        </div>
        <div className="mt-12 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-slate-500">pocket agent · brain</span>
          </div>
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  const stats = [
    { label: "Decisions logged", value: "161" },
    { label: "Active products", value: "7" },
    { label: "Commits this week", value: "42" },
    { label: "Memory files", value: "284" },
  ];
  const recent = [
    {
      sha: "ba852c9",
      title: "Patrick Spotio Tier 2 — knock_polygons + ST_Within counts",
      tag: "shipped",
    },
    {
      sha: "d287544",
      title: "Patrick Spotio Tier 1 — KnockMap + clustering + 12 seed pins",
      tag: "shipped",
    },
    {
      sha: "c9b51de",
      title: "Lead automation pipeline — every path emits lead_created",
      tag: "shipped",
    },
    {
      sha: "10f05ad",
      title: "Marketing analytics page on wc-admin",
      tag: "shipped",
    },
  ];
  return (
    <div className="grid gap-6 p-6 sm:grid-cols-3">
      <div className="space-y-4 sm:col-span-1">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-black/40 p-4"
          >
            <div className="text-xs uppercase tracking-wider text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-accent">
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 sm:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Recent decisions
          </span>
          <span className="text-xs text-slate-600">live feed</span>
        </div>
        <ul className="space-y-2">
          {recent.map((r) => (
            <li
              key={r.sha}
              className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <code className="rounded bg-accent/10 px-2 py-0.5 text-xs font-mono text-accent">
                {r.sha}
              </code>
              <span className="flex-1 text-sm text-slate-300">{r.title}</span>
              <span className="hidden text-xs uppercase tracking-wider text-emerald-400 sm:inline">
                {r.tag}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Ladder() {
  const steps = [
    {
      n: "0",
      price: "Free",
      label: "Lead magnet",
      title: "How I Run 4 Businesses From My Phone Using an AI Brain",
      detail:
        "The exact system. Email capture, no catch. You get the framework I run every build on.",
      cta: null,
      href: null,
    },
    {
      n: "1",
      price: "$15 each",
      label: "Install kits",
      title: "The 5 operator frameworks",
      detail:
        "Dispatch Playbook, Dev-Team Document Set, CLAUDE.md Template Library, Discovery → MVP Prompt Pack, Wire-the-Brain-to-Stack. Each one is the exact document set I run on real client builds. Instant download.",
      cta: "See the kits",
      href: "/dispatch-playbook",
    },
    {
      n: "2",
      price: "$15 each as they ship",
      label: "Capture + Output modules",
      title: "The pack modules",
      detail:
        "Capture Pack: voice, screenshot, share sheet, email, Loom — every thought hits the brain. Output Pack: standup, pre-call brief, customer Q&A in your voice, compete-watch. Modules ship into Pocket Agent one at a time.",
      cta: "See what's shipping",
      href: "/output-pack",
    },
    {
      n: "3",
      price: "$97/mo",
      label: "Pocket Agent",
      title: "The software that runs all of it",
      detail:
        "Hosted at app.aipocketagency.com. Connect GitHub, start your trial. Every kit pre-installed. Every module shipped directly to your dashboard. The brain lives in your repo — you own it forever. Skool community included.",
      cta: "Start your 14-day free trial",
      href: TRIAL_URL,
      primary: true,
    },
  ];

  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-black/40 via-black/20 to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the offer ladder</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Four ways in. One destination.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Start wherever makes sense. Every step is a working piece of the same
          system — and every step points at the same place.
        </p>
        <ol className="mt-10 space-y-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className={`rounded-2xl border p-6 sm:p-7 ${
                s.primary
                  ? "border-accent/40 bg-accent/[0.06] shadow-[0_0_40px_-15px_rgba(34,211,238,0.5)]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                    style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <span
                      className="text-xs uppercase tracking-wider text-slate-500"
                      style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
                    >
                      {s.label}
                    </span>
                    <div className="text-lg font-semibold text-slate-100 sm:text-xl">
                      {s.title}
                    </div>
                  </div>
                </div>
                <span
                  className={`whitespace-nowrap text-sm font-semibold ${s.primary ? "text-accent" : "text-slate-400"}`}
                  style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  {s.price}
                </span>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                {s.detail}
              </p>
              {s.cta && s.href ? (
                <div className="mt-5">
                  {s.primary ? (
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
                    >
                      {s.cta}
                      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                        <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/[0.05] px-5 py-2.5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.10]"
                    >
                      {s.cta}
                      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                        <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
                      </svg>
                    </Link>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Origin() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>origin</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Why I built this
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            I was running multiple brands at the same time — brainstorming one,
            building another, shipping a third, onboarding a client on a
            fourth. It got messy fast. Agents started mixing things up. Folders
            inside the platform didn&apos;t help. Manus would build something
            Codex didn&apos;t know about. Claude Code would refactor a file
            Cursor was halfway through. Every time I needed a different agent
            for a different job, I was manually handing off context,
            copy-pasting decisions, re-explaining what we&apos;d already
            figured out.
          </p>
          <p>
            The bigger problem: I&apos;m not at a desk. I&apos;m at my
            kid&apos;s practice. Or a game. Or in the truck between job sites.
            I needed to run all of this from my phone — approving the next
            agent action, kicking off the next build, watching what shipped —
            without sitting at a screen hitting &ldquo;allow&rdquo; every five
            minutes hoping the agents kept things straight.
          </p>
          <p>
            So I built the brain. File-based, git-versioned, readable by every
            agent on the planet. Then I wired it to a dashboard so I could see
            everything at a glance. Then I started using Dispatch — that&apos;s
            when it all came together. I could spin up as many agents as I
            needed in parallel, every one of them with the exact context they
            needed to keep their lane straight. Manus running in one tab.
            Codex remoted in another. Claude Code in three worktrees at once.
            All sharing the same brain. None of them stepping on each other.
          </p>
          <p>
            That&apos;s when I knew this was real. I was onboarding new
            custom-build clients — going from a 30-minute discovery transcript
            to a working MVP — in hours. From my phone. From wherever I was.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>how it works</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your agent&apos;s context fills up at 40k tokens. Mine doesn&apos;t —
          because the brain lives in files.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            Your business&apos;s ceiling is the information you can hold in
            your head. Pocket Agent raises that ceiling.
          </p>
          <p>
            Persistent memory in markdown. Multi-lane agent orchestration.
            Build one large app or ten in parallel without the working memory
            of any single agent ever filling up. The agent reads from the
            brain, decides, writes back. Tomorrow&apos;s agent picks up exactly
            where today&apos;s left off.
          </p>
        </div>
        <div className="mt-10">
          <h3 className="text-xl font-semibold text-slate-100 sm:text-2xl">
            Two layers run in parallel:
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-sm font-semibold uppercase tracking-wider text-accent">
                Intentional
              </div>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Your conventions, decisions, feature inventories, project
                state. The stuff you&apos;d write down if you had time. The
                brain writes it for you, then any agent reads it before it
                touches anything.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-sm font-semibold uppercase tracking-wider text-accent">
                Ambient
              </div>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Every conversation, every commit, every shipped change captured
                automatically. Searchable a year from now. The full why behind
                every what.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">
          Wire it into{" "}
          <span className="text-slate-100">
            Drive, Gmail, Slack, Notion, Linear, GitHub, Supabase
          </span>{" "}
          — anything with an MCP or API.{" "}
          <span className="text-accent">Your stack, your data.</span>
        </p>
      </div>
    </section>
  );
}

function Pricing() {
  const included = [
    "Hosted web app at app.aipocketagency.com",
    "Connect GitHub and your brain repo is live in minutes",
    "All 5 install kits pre-loaded (Dispatch, Dev-Team, CLAUDE.md, Discovery→MVP, Wire-Brain)",
    "Every Capture + Output module ships directly to your dashboard",
    "Plain-English Decision Query — ask the brain anything, get a cited answer",
    "Skool community — three live calls per week, build sessions with Chase",
    "Your brain repo is yours — git-versioned, you own it forever",
    "Works with Claude, Codex, Cursor, Manus, any MCP-compatible agent",
  ];
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>pricing</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          One tier. $97/mo. 14-day free trial.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Card collected at signup. Nothing charges until day 15. Cancel before
          then and you pay nothing. No annual commitment required — though an
          annual plan is coming.
        </p>
        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/[0.04] p-7 shadow-[0_0_50px_-20px_rgba(34,211,238,0.4)] sm:p-9">
          <div
            className="text-xs uppercase tracking-wider text-slate-400"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            pocket agent · single tier
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold text-accent">$97</span>
            <span className="text-xl text-slate-400">/mo</span>
          </div>
          <div
            className="mt-1 text-sm text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            [ 14-day free trial · cancel anytime ]
          </div>
          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Link
              href={TRIAL_URL}
              className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start your 14-day free trial
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModulesShipping() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <SectionLabel>shipping into pocket agent</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Two packs. Modules ship into your dashboard one at a time.
        </h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
          The Capture Pack is the friction-free door — voice, screenshot, share
          sheet, email, Loom — every thought hits the brain without you typing
          into a CRM. The Output Pack is what the brain does back — standup
          before coffee, brief before every call, customer Q&amp;A in your
          voice, content drafts from past wins.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
          Each module flips to live in your Pocket Agent dashboard with a
          heads-up to subscribers. You don&apos;t hunt for it — it shows up.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <PackCard
            href="/capture-pack"
            pill="[ capture pack · 5 modules ]"
            title="Capture Pack"
            blurb="Tap once. Brain captures the rest. Voice, screenshot, share sheet, email, Loom."
            statusLine="1 of 5 live · ships into your dashboard"
          />
          <PackCard
            href="/output-pack"
            pill="[ output pack · 8 modules ]"
            title="Output Pack"
            blurb="Your brain works while you sleep. Standup, pre-call brief, customer Q&A, compete-watch, more."
            statusLine="O7 live · more shipping now"
          />
        </div>
      </div>
    </section>
  );
}

function PackCard({
  href,
  pill,
  title,
  blurb,
  statusLine,
}: {
  href: string;
  pill: string;
  title: string;
  blurb: string;
  statusLine: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-accent/60 hover:bg-white/[0.06] hover:shadow-[0_0_40px_-15px_rgba(34,211,238,0.6)] sm:p-7"
    >
      <div
        className="text-xs text-cyan-300/70 sm:text-sm"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        {pill}
      </div>
      <h3 className="mt-3 text-2xl font-semibold text-slate-100">{title}</h3>
      <p className="mt-3 flex-1 text-base leading-relaxed text-slate-300">
        {blurb}
      </p>
      <div className="mt-5 flex items-center justify-between">
        <span
          className="text-xs uppercase tracking-wider text-slate-500"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {statusLine}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition group-hover:translate-x-0.5">
          See the catalog
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function WhatItIsNot() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-black/40 via-black/20 to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>not this</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          It&apos;s not a prompt pack. It&apos;s not a skill builder.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            I&apos;ve sat on AI workflow calls with operators charging $5k for
            what amounts to a folder of GPTs and a Notion template. None of
            them are doing this. They&apos;re stacking prompts. I&apos;m
            running a system.
          </p>
          <p>
            This isn&apos;t a prompt trick. It&apos;s an operating system for
            building software with AI — the whole reason the brain exists, and
            the whole reason the software wraps it in something anyone can use
            without being a developer.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhoItsFor() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>for</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Who it&apos;s for
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            Agency operators running 4 client builds at once. Solo SaaS
            builders shipping faster than they can document. Non-technical
            founders who need their AI to build like a real dev team, not
            vibe-code spaghetti. Vibe-coders tired of context resets killing
            the conversation right when it got good. Anyone whose brain has
            become the bottleneck.
          </p>
          <p>
            If you&apos;ve ever rebuilt the same context three times in one
            week, this is for you.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-28">
        <SectionLabel>start here</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          $97/mo. 14-day free trial. Skool included.
        </h2>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          Sign up, connect GitHub, and the brain is running inside Pocket Agent
          in under ten minutes. Every kit pre-installed. Every module lands in
          your dashboard as it ships.
        </p>
        <div className="mt-10 flex w-full max-w-md flex-col items-center gap-4">
          <PrimaryCTA
            label="Start your 14-day free trial"
            sublabel="$97/mo after · cancel anytime"
          />
          <div
            className="whitespace-nowrap text-xs text-cyan-300/60"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            [ or ]
          </div>
          <SecondaryCTA
            href="/dispatch-playbook"
            label="Start with the Dispatch Playbook"
            sublabel="$15 · instant download"
          />
        </div>
        <p className="mt-8 text-sm text-slate-400">
          Want it built FOR you instead?{" "}
          <Link
            href={BUILDOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-4 transition hover:underline"
          >
            Buildout Studios
          </Link>{" "}
          — a full creative studio that builds custom software, websites, web
          apps, and internal tools, with Pocket Agent pre-installed and
          pre-trained on your business.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  const links: { label: string; href: string; external?: boolean }[] = [
    { label: "Pocket Agent", href: TRIAL_URL, external: true },
    { label: "Whited Consulting", href: "https://whited.consulting", external: true },
    { label: "Buildout Studios", href: BUILDOUT_URL, external: true },
    { label: "AthleteOS", href: "https://athlete-os.com", external: true },
    { label: "Dispatch Playbook", href: "/dispatch-playbook" },
  ];
  return (
    <footer className="bg-black/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">
            AI Pocket Agency
          </div>
          <div className="mt-1 text-xs text-slate-500">
            A Whited Consulting brand · Built by an operator. Used by
            operators.
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          {links.map((l) => (
            <li key={l.label}>
              <Link
                href={l.href}
                {...(l.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="transition hover:text-accent"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
          © {new Date().getFullYear()} Whited Consulting. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
