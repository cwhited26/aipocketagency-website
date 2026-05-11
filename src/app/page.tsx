import Image from "next/image";
import Link from "next/link";

const SKOOL_URL = "https://www.skool.com/aipocketagency";
const BUILDOUT_URL = "https://buildoutstudios.com";

export default function Page() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <Manifesto />
      <Origin />
      <HowItWorks />
      <DevTeamArtifacts />
      <WhatItIsNot />
      <WhoItsFor />
      <InsideCTA />
      <Footer />
    </main>
  );
}

function PrimaryCTA({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <Link
      href={SKOOL_URL}
      target="_blank"
      rel="noopener noreferrer"
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
            [ founding-50 · 47/mo · open ]
          </div>
          <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Your AI brain.
            </span>
          </h1>
          <p className="mt-6 text-balance text-xl text-slate-200 sm:text-2xl">
            Built for the context wall you just hit.
          </p>
          <p className="mt-6 max-w-2xl text-balance text-lg text-slate-300 sm:text-xl">
            Persistent memory across every agent — Claude, Codex, Cursor,
            Manus, Dispatch. Pull a decision you made today a year from now
            and the system finds it. Nothing gets lost. No what, no why, no
            how.
          </p>
          <div className="mt-10">
            <PrimaryCTA label="Join the Founding 50" sublabel="$47/mo" />
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Locked for life · 50 spots only
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <Image
            src="/landing-hero.png"
            alt="AI Pocket Agency — the brain that runs from your pocket"
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
            and living your life. Your AI brain is the operating system I built
            so I can run multiple software companies from a phone, from a job
            site, from a hotel, from anywhere. It&apos;s a portable brain for
            your business — agent-agnostic, model-churn-resistant, and built so
            the work happens when it shows up, not when you&apos;re chained to
            a desk.
          </p>
        </div>
        <div className="mt-12 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-slate-500">the brain</span>
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
            your head. The brain raises that ceiling.
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
                your conventions, decisions, feature inventories, project
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
                every conversation, every commit, every shipped change captured
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

function DevTeamArtifacts() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>in the brain</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          What&apos;s already in the brain on day one
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            You don&apos;t get an empty repo. You get the full dev-team
            document set — coding conventions, architecture decision records,
            feature inventories, change log and decision log scaffolds,
            pre-build spec templates, agent rules, security gates, deployment
            checklists. The same documents a senior engineering team would
            build before shipping anything serious.
          </p>
          <p className="text-slate-100">
            There are products on the market sold solely for this checklist.{" "}
            <span className="text-accent">It&apos;s already in the brain.</span>
          </p>
          <p>
            Non-technical operators end up with the same guardrails a
            five-engineer team would have. The agents read these docs first,
            every time, and refuse to ship slop.
          </p>
        </div>
      </div>
    </section>
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
            building software with AI — and it&apos;s the whole reason the
            brain exists.
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

function InsideCTA() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-28">
        <SectionLabel>inside</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          $47/mo or $470/yr (save 2 months). Founding 50 only. Locked for life.
        </h2>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          Five classroom modules. Mon Brain Build. Wed From the Road. Fri
          Office Hours — your real stuck question, an actual answer, 3 PM ET.
        </p>
        <div className="mt-10">
          <PrimaryCTA
            label="Join the Founding 50"
            sublabel="$47/mo · Locked for life"
          />
        </div>
        <div className="mt-12 flex w-full max-w-md flex-col items-center border-t border-white/10 pt-8">
          <div
            className="mb-3 whitespace-nowrap text-xs text-cyan-300/60"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            [ or — just the playbook ]
          </div>
          <p className="text-balance text-sm text-slate-400 sm:text-base">
            Not ready for the community? Grab the Dispatch Playbook — $15.
            Instant download.
          </p>
          <Link
            href="/dispatch-playbook"
            className="mt-3 text-sm font-medium text-accent underline-offset-4 transition hover:underline"
          >
            Get the playbook →
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-400">
          Want it built FOR you instead?{" "}
          <Link
            href={BUILDOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-4 transition hover:underline"
          >
            buildoutstudios.com
          </Link>
        </p>
      </div>
    </section>
  );
}

function Footer() {
  const links: { label: string; href: string; external?: boolean }[] = [
    { label: "Whited Consulting", href: "https://whited.consulting", external: true },
    { label: "Buildout Studios", href: "https://buildoutstudios.com", external: true },
    { label: "AthleteOS", href: "https://athlete-os.com", external: true },
    { label: "Dispatch Playbook", href: "/dispatch-playbook" },
    { label: "Skool group", href: SKOOL_URL, external: true },
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
