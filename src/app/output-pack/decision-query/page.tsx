import type { Metadata } from "next";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const PAGE_URL = "https://aipocketagency.com/output-pack/decision-query";
const RECIPE_URL =
  "https://github.com/cwhited26/whited-brain/blob/main/automations/brain-ask-shortcut-recipe.md";
const DESCRIPTION =
  "Plain-English Decision Query. Ask the brain a question in your terminal or from your phone — get a cited answer in three seconds. The first Output Pack module is live.";

export const metadata: Metadata = {
  title:
    "Plain-English Decision Query — Output Pack O7 | AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Plain-English Decision Query — AI Pocket Agency",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Plain-English Decision Query — AI Pocket Agency",
    description: DESCRIPTION,
  },
};

export default function DecisionQueryInstallPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <WhatItDoes />
      <Install />
      <UseCases />
      <NextStep />
      <Footer />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
      style={{ fontFamily: MONO_FONT }}
    >
      [ {children} ]
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            [ output pack · O7 · live ]
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Ask the brain in plain English. Get a cited answer in three
              seconds.
            </span>
          </h1>
          <p className="mt-6 text-balance text-lg text-slate-200 sm:text-xl">
            The first Output Pack module is live. One command in your
            terminal — or a Siri phrase on your phone — and the brain tells
            you what you decided, with the file and line cited so you can
            verify before you act.
          </p>
          <Link
            href="#install"
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
          >
            Install in two minutes
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhatItDoes() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the problem</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          You decided this two weeks ago. You can&apos;t remember the
          reasoning. So you re-debate.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          You debated whether to ship feature X or feature Y. You picked X.
          Two weeks later somebody asks why and you&apos;re hunting through
          Slack history, Notion, and three old decision logs. Hours lost
          re-litigating something you already settled.
        </p>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Plain-English Decision Query is the antidote. The brain answers
          the question in three seconds. The answer cites the exact file
          and line so you can verify before you act on it. That citation
          discipline is the trust mechanism — every answer is checkable
          against the source.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6">
          <div
            className="mb-3 text-xs text-slate-500"
            style={{ fontFamily: MONO_FONT }}
          >
            $ brain ask &quot;what did we decide about Patrick&apos;s PDF
            cover photo?&quot;
          </div>
          <pre
            className="overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200"
            style={{ fontFamily: MONO_FONT }}
          >{`Cover photo was deferred to Patrick P2. The cover-notes drop-cap fix
shipped on 2026-05-08 (FPHI \`aba06f9\`); the photo-hero treatment moved
to the Phase 2 punch list pending Patrick's Loom feedback on the rendered
output.

Sources:
  BOS/Products/Patrick/Patrick_Decision_Log.md:142
  BOS/Products/Patrick/Patrick_Loom_2026-05-11_Bug_Feature_List.md:128`}</pre>
        </div>
      </div>
    </section>
  );
}

function Install() {
  return (
    <section
      id="install"
      className="border-b border-white/5 scroll-mt-20"
    >
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>install</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Two minutes. CLI today. Siri on your phone next.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          The Output Pack assumes you already have the AI Pocket Agency
          brain pattern running locally — a brain repo with{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            memory/
          </code>{" "}
          and{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            sessions/
          </code>
          , the{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            bin/brain
          </code>{" "}
          CLI on PATH, and{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            ANTHROPIC_API_KEY
          </code>{" "}
          set. If you don&apos;t have that yet, start with the Capture Pack
          and the open-source brain template.
        </p>

        <h3 className="mt-12 text-xl font-semibold text-slate-100 sm:text-2xl">
          1. Pull the latest brain CLI
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          The{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            ask
          </code>{" "}
          subcommand ships in{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            bin/brain
          </code>
          . Pull from the canonical brain template repo or copy the
          subcommand block into your local CLI.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6">
          <pre
            className="overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200"
            style={{ fontFamily: MONO_FONT }}
          >{`cd ~/your-brain-repo
git pull            # if you cloned the brain template

# or copy the \`ask)\` case block from
# https://github.com/cwhited26/whited-brain/blob/main/bin/brain
# into your existing bin/brain`}</pre>
        </div>

        <h3 className="mt-12 text-xl font-semibold text-slate-100 sm:text-2xl">
          2. Confirm the key resolves
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          The CLI reads{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            ANTHROPIC_API_KEY
          </code>{" "}
          from the environment first, then falls back to{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            getsecret
          </code>{" "}
          against 1Password. Same resolution path as{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            brain consolidate
          </code>
          .
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6">
          <pre
            className="overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200"
            style={{ fontFamily: MONO_FONT }}
          >{`export ANTHROPIC_API_KEY=sk-ant-...      # quick check
brain ask "what did we ship today?"      # should print an answer or
                                         # "I don't have context on this."`}</pre>
        </div>

        <h3 className="mt-12 text-xl font-semibold text-slate-100 sm:text-2xl">
          3. Wire the iOS Shortcut (optional, three minutes)
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          The recipe lives in the brain repo. SSH-over-Tailscale is the
          recommended path — no paid app, no Vercel route, no token to
          rotate. The Shortcut accepts a typed or spoken question, pipes
          it through{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-slate-100">
            brain ask
          </code>{" "}
          on your Mac, and shows the answer back on your phone.
        </p>
        <div className="mt-6">
          <Link
            href={RECIPE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/[0.06] px-5 py-2.5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]"
          >
            Open the Shortcut recipe
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>

        <h3 className="mt-12 text-xl font-semibold text-slate-100 sm:text-2xl">
          4. Use the citation
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          Every answer cites the file and line it came from. Before you
          act on the answer, open the cited file. The brain can have
          stale or wrong information — the citation makes that
          checkable in thirty seconds. Skip the check and you&apos;re
          trusting paraphrase over source.
        </p>
      </div>
    </section>
  );
}

function UseCases() {
  const cases: Array<{ title: string; body: string }> = [
    {
      title: "Standup prep",
      body: "Before you open Slack or the calendar, ask the brain what you committed yesterday. Three seconds, no scrolling.",
    },
    {
      title: "Customer call prep",
      body: "Walking to the call? Ask the brain what you decided last time, what's open, and what was promised. Walk in informed.",
    },
    {
      title: "“Did we already address this?”",
      body: "Before doing the work, check whether the brain says you already did. Saves a re-litigation conversation.",
    },
    {
      title: "Onboarding new teammates",
      body: "They ask the brain instead of asking you. You stay focused on the work; they get a cited answer from the source.",
    },
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>where it pays off</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Four real moments the brain replaces five minutes of
          hunting.
        </h2>
        <ul className="mt-10 space-y-4">
          {cases.map((c) => (
            <li
              key={c.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
            >
              <div className="text-base font-semibold text-slate-100 sm:text-lg">
                {c.title}
              </div>
              <p className="mt-2 text-base leading-relaxed text-slate-300 sm:text-lg">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NextStep() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the rest of the pack</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          O7 is the wedge. Seven more modules are queued — get
          notified as each one flips to LIVE.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Daily Standup, Pre-Call Brief, Customer Q&amp;A in Your
          Voice, Weekly Compete-Watch, Content From Past Wins, and
          MVP Signal — the Output Pack roadmap. One email when each
          one ships. No drip. No upsell sequence.
        </p>
        <div className="mt-10">
          <Link
            href="/output-pack#waitlist"
            className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
          >
            <span>Get on the Output Pack list</span>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="currentColor"
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-slate-400">
          The brain pattern, the CLI, and the install recipes are open
          source. The Output Pack is the operating layer on top — paid
          when the full pack ships, free waitlist while modules roll
          out one at a time.
        </p>
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
