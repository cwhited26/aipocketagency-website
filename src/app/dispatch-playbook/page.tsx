import type { Metadata } from "next";
import Link from "next/link";

const CHECKOUT_PATH = "/dispatch-playbook/checkout";

const PAGE_URL = "https://aipocketagency.com/dispatch-playbook";
const PAGE_TITLE = "The Dispatch Playbook — $15 Instant Download | AI Pocket Agency";
const PAGE_DESCRIPTION =
  "Stop being scared to spawn parallel agents. The operator manual for running parallel Claude Code agents without them stepping on each other. $15, instant download — the PDF + markdown bundle lands in your inbox the moment Stripe confirms payment.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagency.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "The Dispatch Playbook — $15 instant download",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["https://aipocketagency.com/og-share.png"],
  },
};

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const SECTIONS: { n: number; title: string }[] = [
  { n: 1, title: "Why Dispatch matters (vs single-thread Claude Code)" },
  { n: 2, title: "The “rogue agent” fear and why it’s solvable" },
  { n: 3, title: "The 3-tier task model: cowork vs code vs main thread" },
  { n: 4, title: "Worktree-based parallel lane pattern (agents don’t step on each other)" },
  { n: 5, title: "Standing rules every lane needs (rebase, verify push, self-cleanup)" },
  { n: 6, title: "How to write a clean lane prompt (verbatim copy, success criteria, blockers)" },
  { n: 7, title: "Verification discipline (lane-report vs disk vs remote vs behavior-verified)" },
  { n: 8, title: "Parallel orchestration patterns (sequential, fan-out, watch-and-merge)" },
  {
    n: 9,
    title:
      "Common failure modes (duplicate lanes, stale branches, push conflicts, FUSE EPERM, dispatch timeouts)",
  },
  { n: 10, title: "Real example walkthroughs (Patrick / APA / TVE — client specifics scrubbed)" },
  { n: 11, title: "What to do when it goes wrong (abort, rollback, recover)" },
];

export default function Page() {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero />
      <Problem />
      <WhatsInside />
      <TheDeal />
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

function BuyCTA({ size = "lg" }: { size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-8 py-4 text-base sm:text-lg" : "px-6 py-3 text-base";
  return (
    <Link
      href={CHECKOUT_PATH}
      className={`group inline-flex flex-col items-center gap-1 rounded-full bg-accent ${pad} font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:flex-row sm:gap-3`}
    >
      <span>Buy — $15 instant download</span>
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

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-24 sm:pt-32">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            [ $15 · instant download ]
          </div>
          <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              The Dispatch Playbook
            </span>
          </h1>
          <p className="mt-6 text-balance text-xl text-slate-200 sm:text-2xl">
            Stop being scared to spawn parallel agents.
          </p>
          <div className="mt-10">
            <BuyCTA />
          </div>
          <p className="mt-4 text-sm text-slate-400">
            PDF + markdown · in your inbox the moment Stripe confirms payment
          </p>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.05] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the problem</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Most operators using Claude Code never touch Dispatch.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            They&apos;ve heard about it. They know parallel lanes would let them
            ship 4 things at once instead of waiting on one chat. But the fear
            is real — agents stepping on each other, branches diverging,
            half-finished pushes, code they didn&apos;t write going to main.
          </p>
          <p>
            So they stay single-threaded. Watch one agent work. Hit
            &ldquo;allow&rdquo; every 5 minutes. Wait.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatsInside() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what&apos;s inside</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The operator manual I should have had.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            The Dispatch Playbook is the operator manual I should have had when
            I started running parallel agents. Eleven sections covering:
          </p>
        </div>
        <ol className="mt-8 space-y-3">
          {SECTIONS.map((s) => (
            <li
              key={s.n}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
            >
              <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                style={{ fontFamily: MONO_FONT }}
              >
                {s.n}
              </span>
              <span className="text-base leading-relaxed text-slate-200 sm:text-lg">
                {s.title}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">
          PDF + markdown bundle, written in plain operator voice.{" "}
          <span className="text-slate-100">No theory. No filler.</span> Just the
          rules I run my own multi-agent setup on.
        </p>
      </div>
    </section>
  );
}

function TheDeal() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-28">
        <SectionLabel>the deal</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          $15. Instant download. First 50 buyers get the live walkthrough.
        </h2>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          $15. Instant download. The moment Stripe confirms payment, the PDF +
          markdown bundle lands in your inbox. No 2-week wait, no shipping
          queue, no founder gate-keeping. You bought it, you have it.
        </p>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          First 50 buyers get an invite to a 30-minute live walkthrough call
          where I screen-share my actual setup running 6 lanes at once and
          answer questions.
        </p>
        <div className="mt-10">
          <BuyCTA />
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Want the whole brain pattern, not just the playbook?{" "}
          <Link
            href="/"
            className="text-accent underline-offset-4 transition hover:underline"
          >
            aipocketagency.com
          </Link>
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-slate-400">
          Delivered as PDF + markdown to the email used at checkout. If it
          doesn&apos;t land within minutes, full refund — just reply to the
          receipt.
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
