import type { Metadata } from "next";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const PAGE_URL = "https://aipocketagency.com/pocket-agent";
const DESCRIPTION =
  "Your business finally has a memory. Pocket Agent captures every decision, drafts emails in your voice, briefs you before every call, and finds old decisions in seconds — with the source. $97/mo, 14-day free trial.";

export const metadata: Metadata = {
  title: "Pocket Agent — Your business finally has a memory | AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Pocket Agent — Your business finally has a memory",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — Your business finally has a memory",
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
      <PriceAnchor />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <BOSCallout />
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

const ARROW = (
  <svg
    aria-hidden
    viewBox="0 0 20 20"
    className="h-5 w-5"
    fill="currentColor"
  >
    <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
  </svg>
);

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
              An AI that remembers what your business already knows.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-slate-200 sm:text-xl">
            Most AI tools forget you between sessions. Pocket Agent remembers
            the context you give it, captures the new stuff as it comes in,
            and helps you use it when work needs to get done. Draft the email.
            Brief the call. Answer the customer. Find the old decision. Keep
            the source.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/start"
              className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start free for 14 days
              {ARROW}
            </Link>
            <div
              className="text-xs text-slate-500"
              style={{ fontFamily: MONO_FONT }}
            >
              [ $97/mo after trial · your data stays yours ]
            </div>
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
          The AI tools cost money and forget everything. The team you&apos;d
          need costs more. The work piles up. Pocket Agent is the exit from
          that loop.
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
      title: "Voice notes",
      body: "Tap a Shortcut, talk for 60 seconds, your AI files it. Driving thoughts, shower ideas, walking calls — nothing dies in your head.",
    },
    {
      title: "Screenshots",
      body: "Take a screenshot, your AI OCRs it, tags it, files it. Competitor pricing pages and customer DMs stop disappearing into your screenshots folder.",
    },
    {
      title: "Shared links",
      body: "Hit Share on any URL — Safari, Facebook, X, LinkedIn — type one word, it lands in your business. Your home-screen graveyard becomes a real research folder.",
    },
    {
      title: "Email forwards",
      body: "Forward any email to your brain address — customer replies, competitor newsletters, leads. Parsed, threaded, searchable. The inbox stops eating things.",
    },
    {
      title: "Loom transcripts",
      body: "Paste a Loom link. Transcript + summary + action items in your business in under 30 seconds. The \"I'll watch this later\" graveyard dies.",
    },
  ];
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what you send it</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Send it anything. It remembers all of it.
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
      title: "Daily standup",
      body: "Yesterday you committed X and Y. Today's calendar has these calls. Flagged two stale items. Sent to iMessage, Slack, or email the moment your alarm goes off.",
    },
    {
      title: "Pre-call brief",
      body: "Every external call gets a brief: who you're meeting, what you decided last time, open threads. Five-second read, walk in informed.",
    },
    {
      title: "Customer Q&A drafts",
      body: "Customer asks a question — within 30 seconds you get a draft answer in your voice with sources cited. Tap to approve, send. The \"I'll respond later\" pile dies.",
    },
    {
      title: "Content from past wins",
      body: "Your AI reads your decision log, sales calls, and customer Q&A and drafts 3–5 content pieces in your voice — Skool post, LinkedIn, drip email, ad hook. Tied to themes that keep recurring. No blank page.",
    },
    {
      title: "Plain-English decision query",
      body: "Ask \"what did we decide about Patrick's PDF cover?\" Answer in three seconds with the exact decision log entry and session excerpt cited. The \"I know we figured this out\" graveyard dies.",
    },
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what you get back</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          It does the work you don&apos;t have time for.
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

function PriceAnchor() {
  const items = [
    "Draft this email.",
    "Brief me before this call.",
    "Answer this customer.",
    "Find the decision we made.",
    "Summarize what changed.",
    "Pull the source.",
  ];
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.03] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what it replaces</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Hiring an EA, a writer, an analyst, and a customer-support
          assistant can run $8k–$15k/mo.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Pocket Agent gives you the first-pass work those people would chase
          down all day:
        </p>
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 text-base text-slate-200"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">
          You keep control. Your Pocket Agent keeps the context.
        </p>
      </div>
    </section>
  );
}

function Pricing() {
  const included = [
    "14-day free trial",
    "Your Pocket Agent",
    "Business memory that carries between conversations",
    "Email drafts in your voice",
    "Call briefs before customer calls",
    "Source-backed customer reply drafts",
    "Voice note, screenshot, email, link, and transcript capture",
    "Weekly live builds with Chase",
    "Your data stays yours",
  ];
  return (
    <section
      id="pricing"
      className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent"
    >
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>pricing</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          One plan. Everything included.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          Card collected at signup. Nothing charges until day 15. Cancel before
          then and you pay nothing.
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
            <span className="text-xl text-slate-400">/mo after your 14-day trial</span>
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
              Start your 14-day trial
              {ARROW}
            </Link>
            <p
              className="mt-3 text-center text-xs text-slate-500"
              style={{ fontFamily: MONO_FONT }}
            >
              [ card today · charged on day 15 · cancel anytime ]
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "How long does it take to get working?",
      a: "Sign up, connect, send your first voice note or email — usable in minutes.",
    },
    {
      q: "Do I need to know anything technical?",
      a: "No. If you can take a screenshot or forward an email, you can use Pocket Agent.",
    },
    {
      q: "Does it train on my data?",
      a: "No. Your content lives in your account, never used to train shared models.",
    },
    {
      q: "What happens when I cancel?",
      a: "You keep everything. Your data stays yours.",
    },
    {
      q: "Can it send messages without me approving them?",
      a: "No. Every email and customer reply is a draft you approve first.",
    },
    {
      q: "Are the kits included?",
      a: "Yes. Members get all 5 standalone kits plus every new capability included.",
    },
    {
      q: "What about the Skool community?",
      a: "Included with Pocket Agent. Weekly live builds with Chase — three calls per week.",
    },
    {
      q: "What if I want this built around my exact business?",
      a: "Buildout Studios handles custom builds, websites, and software. Pocket Agent is the starting point. BOS is the custom path.",
    },
    {
      q: "Is this another tool for scoping my next AI project?",
      a: "No. Pocket Agent is the ongoing memory layer for your business. It captures what you send it every day, drafts the work that piles up, surfaces decisions you made months ago. Not a one-time setup tool. You don't \"scope a project and finish\" — you keep using it as long as you keep running the business.",
    },
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>questions</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Common questions.
        </h2>
        <dl className="mt-10 space-y-6">
          {faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
            >
              <dt className="text-base font-semibold text-slate-100 sm:text-lg">
                {faq.q}
              </dt>
              <dd className="mt-2 text-base leading-relaxed text-slate-300 sm:text-lg">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>
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
          Sign up and your AI is running — every capability active, Skool
          community included.
        </p>
        <div className="mt-10">
          <Link
            href="/start"
            className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
          >
            Start your 14-day trial
            {ARROW}
          </Link>
          <p
            className="mt-3 text-xs text-slate-500"
            style={{ fontFamily: MONO_FONT }}
          >
            [ card today · charged on day 15 · cancel anytime ]
          </p>
        </div>
      </div>
    </section>
  );
}

function BOSCallout() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-slate-500">
          Want this built around your exact business?{" "}
          <a
            href="https://buildoutstudios.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
          >
            Buildout Studios
          </a>{" "}
          handles custom builds, websites, and software. Pocket Agent is the
          starting point. BOS is the custom path.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-3xl px-6 pt-12 pb-6 text-center">
        <p className="text-sm leading-relaxed text-slate-500">
          AI Pocket Agency is the studio behind Pocket Agent, the $15 operator
          kits, and the Skool community where we build it all in public. We give
          your business a memory that doesn&apos;t reset every chat.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          <Link href="/about" className="text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline">
            About AI Pocket Agency
          </Link>
          {" · "}
          <Link href="/" className="text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline">
            Homepage
          </Link>
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
