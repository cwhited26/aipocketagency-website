import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/about";
const DESCRIPTION =
  "Pocket Agent is the one chat that runs your business with you. Built by an operator who runs his own businesses on it before charging anyone else.";

export const metadata: Metadata = {
  title: "About — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "About — Pocket Agent",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-24 sm:pt-28">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Pocket Agent
          </h1>
          <p className="mt-6 text-balance text-xl leading-relaxed text-slate-200 sm:text-2xl">
            The one chat that runs your business with you. Built by an operator
            who runs his own businesses on it before charging anyone else.
          </p>
        </div>
      </section>

      <section className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="space-y-10 text-lg leading-relaxed text-slate-300">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                What we are
              </h2>
              <p className="mt-4">
                A studio, not a done-for-you agency. We ship one product we stand
                behind — Pocket Agent, the chat that remembers your business,
                does the work across your tools, and waits for your okay before
                anything goes out. There&apos;s a developer edition at getpa.dev
                for the people who want to build on the same brain, and a Skool
                community where we build it all in public.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                Why we built this
              </h2>
              <p className="mt-4">
                Chase runs a roofing company, a software studio, and a
                youth-sports product — and for a long time the thing holding all
                of it together was him: his memory, his phone, his willingness to
                answer the same question for the fourth time that week. Pocket
                Agent is the system he built to stop being the bottleneck. Not a
                demo. The actual thing he uses to run clients, ship software, and
                keep operations moving from a phone between job sites. We prove
                every piece on our own operations before we charge anyone for it.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                Where we&apos;re going
              </h2>
              <p className="mt-4">
                More of the work handed off — more tools it can act on, more
                specialists your team can ask, more of the busywork running on
                its own with you in front of it. The only constraint is proving
                each piece in the field before we ship it.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <PrimaryCTA label="Start for $37" href="/start?tier=pro" />
          </div>
        </div>
      </section>

      {/* ELEVATOR PITCH — for founders, partners, and press to grab (PA-POS-16 §2.2). */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
            The pitch, in one breath
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            For anyone who needs to explain Pocket Agent fast.
          </p>

          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300/80">
                15 seconds
              </div>
              <p className="mt-3 text-lg leading-relaxed text-slate-200">
                Every business owner’s being told they need AI agents. Everyone’s
                selling them one at a time. Pocket Agent is all of them, packaged
                and ready to deploy, running on accounts you own. $37 a month.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                30 seconds
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
                Business owners are getting sold one-off AI agents — a sales agent,
                a content agent, a research agent — for a hundred bucks a month
                each. Pocket Agent packages all of them into one workspace for $37 a
                month, even if you know nothing about AI. We did the connecting. You
                just tell it about your business and it becomes your second brain.
                Everything runs on accounts you own — you keep it even if you
                cancel.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
