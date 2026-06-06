import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagency.com/about";
const DESCRIPTION =
  "AI Pocket Agency is the studio behind Pocket Agent — the one chat that runs your business with you. Built by an operator who runs his own businesses on it.";

export const metadata: Metadata = {
  title: "About — AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "About — AI Pocket Agency",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
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
            AI Pocket Agency
          </h1>
          <p className="mt-6 text-balance text-xl leading-relaxed text-slate-200 sm:text-2xl">
            The studio behind Pocket Agent — the one chat that runs your business
            with you. Built by an operator who runs his own businesses on it
            before charging anyone else.
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
            <PrimaryCTA label="Start your 14-day trial" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
