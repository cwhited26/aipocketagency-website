import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { COMPARE_LINKS } from "@/data/marketing/compare-pages";

const PAGE_URL = "https://aipocketagent.com/compare";
const TITLE = "Pocket Agent vs the Field — Honest Comparisons";
const DESCRIPTION =
  "Pocket Agent against Twin, Catch, Lindy, Zapier, and Claude Cowork — feature by feature, with the rows they win called out. The through-line: you own the stack, you rent the workers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function CompareIndexPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 text-center sm:pb-20">
            <div
              className="mb-5 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pocket agent vs the field ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Every comparison here concedes something.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Five head-to-heads, feature by feature, with the rows the other product wins called
              out in its own column. The one line none of them can cross: everything Pocket Agent
              builds lands in accounts you own. You own the stack. You rent the workers.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
              <SecondaryCTA href="/pricing" label="See pricing" />
            </div>
          </div>
        </section>

        {/* THE FIVE */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="grid gap-5">
              {COMPARE_LINKS.map((c) => (
                <Link
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.03] sm:p-8"
                >
                  <div
                    className="text-xs uppercase tracking-wider text-slate-500 transition group-hover:text-cyan-300/80"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    Pocket Agent vs {c.label}
                  </div>
                  <p className="mt-3 text-xl font-semibold leading-snug text-slate-100 sm:text-2xl">
                    {c.hook}
                  </p>
                  <p className="mt-3 text-sm text-cyan-300">Read the comparison →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section>
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The cheapest way to settle it.
            </h2>
            <p className="mt-5 text-lg text-slate-300">
              Run Pocket Agent against a week of your real work and compare what actually got
              done.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
              <SecondaryCTA href="/pricing" label="See pricing" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
