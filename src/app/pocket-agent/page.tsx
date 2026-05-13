import type { Metadata } from "next";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const PAGE_URL = "https://aipocketagency.com/pocket-agent";
const DESCRIPTION =
  "Pocket Agent is the hosted AI brain for your business. It captures every decision you make, drafts your emails, briefs you before every call, and answers customer questions in your voice. $97/mo, 14-day free trial.";

export const metadata: Metadata = {
  title: "Pocket Agent — The AI brain for your business | AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Pocket Agent — The AI brain for your business",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — The AI brain for your business",
    description: DESCRIPTION,
  },
};

export default function PocketAgentPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <OldVsNew />
      <WhatItCaptures />
      <WhatItGivesBack />
      <Pricing />
      <FinalCTA />
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
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            [ pocket agent · $97/mo · 14-day free trial ]
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Your AI keeps forgetting everything. Pocket Agent doesn&apos;t.
            </span>
          </h1>
          <p className="mt-6 text-balance text-lg text-slate-200 sm:text-xl">
            Sign up, and your AI remembers every decision you&apos;ve ever
            made — searchable in three seconds. It drafts your emails. Briefs
            you before every call. Handles customer Q&amp;A in your voice.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href="/start"
              className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start your 14-day free trial
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-5 w-5"
                fill="currentColor"
              >
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </Link>
            <Link
              href="/dispatch-playbook"
              className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
            >
              Start with a $15 kit instead
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function OldVsNew() {
  const oldWay = [
    "Re-explain your business every session — who you are, what you do, what you decided last month",
    "Hunt through Slack history, Notion, and three old docs for a decision you already made",
    "Pay $80/mo per seat for tools that forget you the moment you close the tab",
    "Hire an EA, a marketer, and an analyst to do the work — or it just doesn't get done",
    "Stop paying, lose everything — your data lives on their servers",
  ];
  const newWay = [
    "Your AI remembers every decision you've made — ask in plain English, cited answer in three seconds",
    "Captures voice memos, screenshots, emails, Loom recordings — nothing dies in your head",
    "One flat rate. All of it included. No per-seat math.",
    "Drafts your standup before coffee, briefs you before every call, handles Q&A in your voice",
    "Your data stays yours — no lock-in, no platform wall",
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <SectionLabel>what breaks</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          This is the same problem every time.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          The AI tools cost money and forget everything. The team you&apos;d need
          costs more. The work piles up. Pocket Agent is the exit from that loop.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6 sm:p-7">
            <div
              className="mb-5 text-xs font-semibold uppercase tracking-wider text-red-400"
              style={{ fontFamily: MONO_FONT }}
            >
              [ how it breaks ]
            </div>
            <ul className="space-y-3">
              {oldWay.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-base leading-snug text-slate-400"
                >
                  <span
                    className="mt-0.5 shrink-0 text-red-500/70"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    ×
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 sm:p-7">
            <div
              className="mb-5 text-xs font-semibold uppercase tracking-wider text-accent"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pocket agent ]
            </div>
            <ul className="space-y-3">
              {newWay.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-base leading-snug text-slate-200"
                >
                  <span className="mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full bg-accent flex-none translate-y-[6px]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatItCaptures() {
  const captures = [
    {
      title: "Voice → remembered",
      body: "Tap a Shortcut, talk for 60 seconds. Driving thoughts, job-site walkthroughs, anything. Your AI files it automatically. Nothing dies in your head.",
    },
    {
      title: "Screenshots → searchable",
      body: "Take a screenshot and your AI tags it and files it. Competitor pricing pages, customer DMs, receipts — they stop disappearing into the screenshots folder.",
    },
    {
      title: "Share any URL → organized",
      body: "Hit Share from Safari, Facebook, LinkedIn, anywhere. Type one word. It lands in your Pocket Agent, sorted. No more bookmarks you never open.",
    },
    {
      title: "Email → searchable",
      body: "Forward any email to your brain address — customer replies, competitor newsletters, leads. Parsed and searchable. The inbox stops eating things.",
    },
    {
      title: "Loom recordings → transcript + summary",
      body: "Paste a Loom link. Transcript, summary, and action items in under 30 seconds. The 'I'll watch this later' pile dies.",
    },
  ];
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what your pocket agent captures</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Five things your AI files automatically. You don&apos;t type a word.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Friction equals forgotten. Remove the friction, the memory compounds.
        </p>
        <ul className="mt-10 space-y-4">
          {captures.map((c) => (
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

function WhatItGivesBack() {
  const outputs = [
    {
      title: "Standup before coffee",
      body: "Yesterday you committed X and Y. Today's calendar has these calls. The brain flagged two stale items. In your iMessage or Slack before your alarm stops.",
    },
    {
      title: "Pre-call brief",
      body: "Walking to the call? Your AI sends a brief: who you're meeting, what you decided last time, open threads, what to drive. Five-second read, walk in informed.",
    },
    {
      title: "Customer Q&A in your voice",
      body: "Customer asks a question. Within 30 seconds you get a draft answer in your voice with sources cited. Tap to approve, send. The 'I'll respond later' pile dies.",
    },
    {
      title: "Plain-English search",
      body: "Ask 'what did we decide about Patrick's PDF cover?' Answer in three seconds with the exact decision log entry cited. The 'I know we figured this out' graveyard dies.",
    },
    {
      title: "Content from past wins",
      body: "Your AI reads your decisions and past work, drafts three to five content pieces in your voice — Skool post, LinkedIn, drip email, ad hook. Tied to the themes that keep coming up. No blank page.",
    },
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what your pocket agent gives back</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Five things that stop piling up.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Without outputs you have a sophisticated note-taking system. With
          outputs you have a second brain that works for you.
        </p>
        <ul className="mt-10 space-y-4">
          {outputs.map((o) => (
            <li
              key={o.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
            >
              <div className="text-base font-semibold text-slate-100 sm:text-lg">
                {o.title}
              </div>
              <p className="mt-2 text-base leading-relaxed text-slate-300 sm:text-lg">
                {o.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Pricing() {
  const included = [
    "Everything in What it captures — voice, screenshots, share links, email, Loom",
    "Everything in What it gives back — standup, brief, Q&A, search, content",
    "Plain-English search over every past decision, with the source cited",
    "Skool community included — three live calls per week",
    "Pocket Agent gets sharper every week — you don't lift a finger",
    "Your data stays yours — no platform lock-in",
  ];
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>pricing</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          One tier. $97/mo. 14-day free trial.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          An EA + a marketer + an analyst who could do all of this — badly —
          would cost you $8,000–$15,000 a month. Your Pocket Agent does it.
          Card collected at signup, nothing charges until day 15.
        </p>
        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/[0.04] p-7 shadow-[0_0_50px_-20px_rgba(34,211,238,0.4)] sm:p-9">
          <div
            className="text-xs uppercase tracking-wider text-slate-400"
            style={{ fontFamily: MONO_FONT }}
          >
            pocket agent · single tier
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold text-accent">$97</span>
            <span className="text-xl text-slate-400">/mo</span>
          </div>
          <div
            className="mt-1 text-sm text-slate-500"
            style={{ fontFamily: MONO_FONT }}
          >
            [ 14-day free trial · cancel anytime ]
          </div>
          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-base text-slate-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Link
              href="/start"
              className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start your 14-day free trial
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
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <SectionLabel>start here</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          $97/mo. 14-day free trial. Your data stays yours.
        </h2>
        <p className="mt-6 text-balance text-lg leading-relaxed text-slate-300">
          Sign up and your AI is running — every capability active,
          Skool community included. Pocket Agent gets sharper every week.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/start"
            className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
          >
            Start your 14-day free trial
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="currentColor"
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
          <Link
            href="/dispatch-playbook"
            className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
          >
            Start with a $15 kit instead
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
          AI Pocket Agency · Built by a builder. Run in the field.{" "}
          <Link href="/" className="text-accent transition hover:underline">
            Back to the homepage
          </Link>
          .
        </p>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
          © {new Date().getFullYear()} Whited Consulting. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
