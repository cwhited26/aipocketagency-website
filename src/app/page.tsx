import Link from "next/link";

const SKOOL_URL = "https://www.skool.com/aipocketagency";

const deliverables: { label: string; value: string }[] = [
  { label: "The AI Brain Install", value: "$997" },
  { label: "The Multi-Agent Workflow", value: "$497" },
  { label: "The Custom Build Playbook", value: "$497" },
  { label: "The Skill Library", value: "$297" },
  { label: "The Discovery Call → Video Pipeline", value: "$397" },
  { label: "Live Builds 2-3x Weekly", value: "$1,200/yr" },
  { label: "Founder's Office Hours", value: "$1,200/yr" },
  { label: "The Builder Network", value: "priceless" },
  { label: "Lifetime Updates", value: "$2,000+" },
];

const audience = [
  "small business owner",
  "content creator",
  "service provider",
  "aspiring agency builder",
  "AI-curious entrepreneur",
];

export default function Page() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <MemoryWall />
      <Hook />
      <DashboardPreview />
      <AntiGuru />
      <Audience />
      <Deliverables />
      <Guarantee />
      <Urgency />
      <FinalCTA />
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
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-24 text-center sm:pt-32">
        <SectionLabel>AI Pocket Agency · Founding 50</SectionLabel>
        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Run an AI agency
          <br />
          <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            from your pocket.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-slate-300 sm:text-xl">
          Get the AI brain that makes it possible — the file-based memory
          and multi-lane agent system I use to run real software businesses
          from anywhere, with any agent. No more context walls.
        </p>
        <div className="mt-10">
          <PrimaryCTA
            label="Join the Founding 50"
            sublabel="$47/mo"
          />
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Locked for life · 50 spots only · Then $97/mo
        </p>
      </div>
    </section>
  );
}

function MemoryWall() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.05] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>The wall you just hit</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Built for the wall you just hit.
        </h2>
        <div className="mt-6 space-y-5 text-lg text-slate-300">
          <p>
            You&apos;re vibe-coding a real SaaS. The agent&apos;s humming.
            Then your context fills up around the 40k-token mark and you
            don&apos;t know how to keep going. Multiple projects in parallel?
            Forget it.
          </p>
          <p className="text-slate-100">
            Your agent&apos;s context fills up at 40k tokens.{" "}
            <span className="text-accent">
              Mine doesn&apos;t — because the brain lives in files.
            </span>
          </p>
          <p>
            Persistent memory in markdown. Multi-lane agent orchestration.
            Build one large app or ten in parallel without the working
            memory of any single agent ever filling up. The agent reads
            from the brain, decides, writes back. Tomorrow&apos;s agent
            picks up exactly where today&apos;s left off.
          </p>
          <p className="text-slate-400">
            This isn&apos;t a prompt trick. It&apos;s an operating system
            for building software with AI — and it&apos;s the whole reason
            the brain exists.
          </p>
        </div>
      </div>
    </section>
  );
}

function Hook() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <p className="text-balance text-xl leading-relaxed text-slate-200 sm:text-2xl">
          You shouldn&apos;t have to choose between building real businesses
          and living your life. Your AI brain is the operating system I built
          so I can run multiple software companies from a phone, from a job
          site, from a hotel, from anywhere. It&apos;s a portable brain for
          your business —{" "}
          <span className="text-accent">agent-agnostic</span>,{" "}
          <span className="text-accent">model-churn-resistant</span>, and built
          so the work happens when it shows up, not when you&apos;re chained
          to a desk.
        </p>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="mb-8 text-center">
          <SectionLabel>The receipt</SectionLabel>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            This is the brain that runs my businesses.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Real activity. Real decisions. Real velocity. The dashboard
            isn&apos;t decoration — it&apos;s the receipt that the brain is
            real, working, and producing measurable output.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-slate-500">
              brain.buildoutstudios.co
            </span>
          </div>
          <DashboardMock />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Replace with real screenshot/GIF post-launch.
        </p>
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

function AntiGuru() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-black/40 via-black/20 to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>Anti-guru</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Tired of $47 AI courses that teach you how to ask Claude better
          questions?
        </h2>
        <div className="mt-6 space-y-5 text-lg text-slate-300">
          <p>
            So am I. This isn&apos;t a course. It isn&apos;t a prompt pack.
            It&apos;s the actual system — the AI brain — that I run my own
            businesses on.
          </p>
          <p>
            You get the structure, the conventions, the workflows, and the
            live builds.{" "}
            <span className="text-slate-100">Platform-agnostic.</span>{" "}
            <span className="text-slate-100">Model-agnostic.</span> If the
            agent landscape shifts tomorrow, your AI brain still works.
          </p>
        </div>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>Built for you</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Built with beginners in mind.
        </h2>
        <p className="mt-3 text-lg text-slate-300">
          No coding. No tech background. No overwhelm.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {audience.map((a) => (
            <li
              key={a}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent/15 text-accent">
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span className="text-base text-slate-200">{a}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-base text-slate-400">
          If you&apos;re any of the above, this is built for you.
        </p>
      </div>
    </section>
  );
}

function Deliverables() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>What you get</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The deliverables stack.
        </h2>
        <ul className="mt-8 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {deliverables.map((d) => (
            <li
              key={d.label}
              className="flex items-center gap-4 px-5 py-4 sm:px-6"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span className="flex-1 text-base text-slate-200 sm:text-lg">
                {d.label}
              </span>
              <span className="text-sm font-medium text-slate-400 sm:text-base">
                {d.value}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-4 bg-accent/10 px-5 py-5 sm:px-6">
            <span className="flex-1 text-base font-semibold text-slate-100 sm:text-lg">
              Total Value
            </span>
            <span className="text-lg font-bold text-accent sm:text-xl">
              $7,000+
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Guarantee() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>Guarantee</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          One command setup. You&apos;re building inside 5 minutes.
        </h2>
        <p className="mt-4 text-lg text-slate-300">
          No 7-day onboarding. No 47-step checklist. Run the install
          command, point your agent at the brain, ship your first task —
          all inside the first 5 minutes. If something blocks you, I&apos;ll
          personally walk you through it on a call.
        </p>
      </div>
    </section>
  );
}

function Urgency() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>Founding 50 only</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          $47/mo. Locked for life.
        </h2>
        <p className="mt-4 text-lg text-slate-300">
          After the founding 50 fill, the price goes to{" "}
          <span className="text-slate-100">$97/mo</span>. Existing members
          keep $47/mo forever.
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-28">
        <h2 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
          Lock in the founding rate.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-lg text-slate-300">
          Join the AI Pocket Agency. Get the brain. Run the work from
          wherever you are.
        </p>
        <div className="mt-10">
          <PrimaryCTA
            label="Lock in founding rate"
            sublabel="$47/mo · Founding 50"
          />
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Cancel anytime. The brain is yours regardless.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  const links: { label: string; href: string }[] = [
    { label: "Whited Consulting", href: "https://whitedconsulting.com" },
    { label: "Buildout Studios", href: "https://buildoutstudios.com" },
    { label: "AthleteOS", href: "https://athleteos.com" },
    { label: "Skool group", href: SKOOL_URL },
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
                target="_blank"
                rel="noopener noreferrer"
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
