// /workshop — the Business Brain Workshop evergreen sales page (PA-POS-38). Voice per
// voice/chase-spec.md + the PA-POS-19 ownership frame; the transparent money frame per §24.7
// (honest math, no urgency theater, cancel-anytime visible). Copy lives in lib/workshop/copy.ts
// behind the vitest voice gate.

import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import { WorkshopSlotPicker } from "@/components/marketing/workshop/slot-picker";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

const PAGE_URL = "https://aipocketagent.com/workshop";
const DESCRIPTION =
  "Give your AI a permanent memory of your business in 60 minutes. Build a five-zone Business Brain in a GitHub repo you own — workbook, template repo, 30 days of Business Agent, and Skool access included. $97.";

export const metadata: Metadata = {
  title: "The Business Brain Workshop — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: WORKSHOP_COPY.hero.headline,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: WORKSHOP_COPY.hero.headline,
    description: DESCRIPTION,
  },
};

export default function WorkshopPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-24">
            <div className="mb-4 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
              {WORKSHOP_COPY.hero.pill}
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
              {WORKSHOP_COPY.hero.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              {WORKSHOP_COPY.hero.sub}
            </p>
            <div className="mt-8">
              <a
                href="#sessions"
                className="inline-flex items-center justify-center rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
              >
                {WORKSHOP_COPY.cta}
              </a>
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight">What $97 buys</h2>
            <ul className="mt-6 space-y-4">
              {WORKSHOP_COPY.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-[15px] leading-relaxed text-slate-300">
                  <span className="mt-1 text-accent" aria-hidden>
                    →
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* TRANSPARENT FRAME */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8">
              <div className="mb-3 text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
                [ {WORKSHOP_COPY.frame.heading.toLowerCase()} ]
              </div>
              <p className="text-xl font-bold tracking-tight sm:text-2xl">
                {WORKSHOP_COPY.frame.valueLine}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                {WORKSHOP_COPY.frame.renewal}
              </p>
            </div>
          </div>
        </section>

        {/* SLOT PICKER */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <WorkshopSlotPicker />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
