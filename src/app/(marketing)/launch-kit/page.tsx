import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/launch-kit";
const DESCRIPTION =
  "The AI Office Launch Kit — how you go from empty workspace to working agents in your first week. Included free with every Pocket Agent subscription. Guided Business Brain setup, 3 prebuilt Personas, 5 workflow templates, the setup checklist, your first Mission Control review, the Skool community, and the Implementation Guarantee.";

export const metadata: Metadata = {
  title: "The AI Office Launch Kit — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "The AI Office Launch Kit — from empty workspace to working agents in your first week.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
};

const STACK: { name: string; body: string; value: string }[] = [
  {
    name: "Business Brain Setup walkthrough",
    body: "A guided flow that builds your Business Brain from what you already know — no markdown, no terminal, no git. You answer plain questions; the Kit writes your seed brain files for you. The done-for-you version of this is the core of the $997 Setup — here you do it guided, free.",
    value: "$497 value",
  },
  {
    name: "3 prebuilt Personas",
    body: "An Admin Agent, a Sales Follow-Up Agent, and a Content Agent — configured and ready to put to work on day one, scoped to the right zones of your brain. The same three workers the homepage promises.",
    value: "$291 value",
  },
  {
    name: "5 workflow templates",
    body: "Daily brief, email draft, lead follow-up, content repurposing, and your first Mission Control review. Steal and run — each one activates with a tap.",
    value: "$245 value",
  },
  {
    name: "The AI Office Setup Checklist",
    body: "Non-technical, step by step, so you always know the next thing to do: connect your brain → run the Brain Setup → put a Persona to work → connect your first tool → run your first workflow → read your first Mission Control review.",
    value: "$47 value",
  },
  {
    name: "Your first Mission Control review",
    body: "A guided walkthrough that teaches you to read the cockpit — the six tiles, the Active-right-now pane, what “staged for approval” means, and the Cost tab. You trust the agents before you hand over real work.",
    value: "$97 value",
  },
  {
    name: "The Skool community",
    body: "Where you get the walkthroughs, the live Q&A, and the help that turns “I have the software” into “I have a program.” The community is part of the Kit.",
    value: "$97/mo value",
  },
];

const WEEK: { label: string; body: string }[] = [
  {
    label: "Day 1",
    body: "Connect your brain, run the Brain Setup walkthrough. You have a Business Brain.",
  },
  {
    label: "Days 2–3",
    body: "Put a Persona to work; run your first email draft + daily brief. You see the first real output.",
  },
  {
    label: "Days 4–5",
    body: "Connect your first tool — Gmail, Calendar, QuickBooks — and run your first lead follow-up. The agent works across your tools.",
  },
  {
    label: "Days 6–7",
    body: "Your first Mission Control review. You trust the cockpit, and the workspace is running your work.",
  },
];

export default function LaunchKitPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-24">
            <div
              className="mb-5 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ free with every subscription ]
            </div>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              The AI Office Launch Kit — how you go from empty workspace to
              working agents in your first week.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              The guided setup included free with every subscription. It’s the
              difference between buying software and getting it running.
            </p>
          </div>
        </section>

        {/* WHAT’S IN IT */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What’s in it.
            </h2>
            <div className="mt-8 space-y-4">
              {STACK.map((s) => (
                <div
                  key={s.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-semibold text-slate-100">
                      {s.name}
                    </h3>
                    <span
                      className="shrink-0 text-xs text-cyan-300/80"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {s.value}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Total value if you bought these apart: well into four figures.
              Included with your subscription, free.
            </p>
          </div>
        </section>

        {/* DELIVERY */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it gets delivered.
            </h2>
            <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-300">
              <p>
                A guided onboarding flow inside the app walks you through the
                setup, alongside a personal welcome video Chase screen-records —
                the human front of the Kit — that you follow at your own pace.
              </p>
              <p>
                The Skool community is the standing home of the live and recorded
                help: the walkthroughs, the office hours, the answers when you
                get stuck.
              </p>
            </div>
          </div>
        </section>

        {/* YOUR FIRST WEEK */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Your first week.
            </h2>
            <p className="mt-3 text-slate-400">
              A day-by-day path, not a vague “soon.”
            </p>
            <div className="mt-8 space-y-5">
              {WEEK.map((w) => (
                <div key={w.label} className="flex gap-5">
                  <div
                    className="w-24 shrink-0 pt-0.5 text-sm font-semibold text-cyan-300/90"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {w.label}
                  </div>
                  <p className="flex-1 text-[15px] leading-relaxed text-slate-300">
                    {w.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[15px] leading-relaxed text-slate-300">
              By the end of week one you have working agents, not a
              half-configured app you’ll abandon by week two.
            </p>
          </div>
        </section>

        {/* GUARANTEE + CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 text-center">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                The Implementation Guarantee.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
                Complete the setup steps in your first 7 days, or Pocket Agent
                helps you finish them. The only real risk with software like this
                is buying it and never getting it running. We took that off the
                table.
              </p>
              <div className="mt-8 flex justify-center">
                <PrimaryCTA
                  href="/start?tier=starter"
                  label="Start at $37/mo — the Kit’s included"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
