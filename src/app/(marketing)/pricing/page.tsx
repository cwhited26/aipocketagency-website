import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import PricingPlans from "./PricingPlans";
import ComparisonMatrix from "./ComparisonMatrix";
import MoneyMath from "./MoneyMath";
import PartsVsProduct from "./PartsVsProduct";

const PAGE_URL = "https://aipocketagent.com/pricing";
const DESCRIPTION =
  "Three ways into your AI Agent Workspace. Personal Brain $37, Business Agent $97, AI Agent Workspace $497. Every plan includes the AI Office Launch Kit, free. Cancel any time.";

export const metadata: Metadata = {
  title: "Pricing — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Three ways into your AI Agent Workspace.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Three ways into your AI Agent Workspace.",
    description: DESCRIPTION,
  },
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-24">
            <div
              className="mb-4 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ choose your Pocket Agent workspace ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
              Start with your Business Brain. Upgrade when your agents need more
              execution.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Personal Brain, Business Agent, or the full AI Agent Workspace. Start
              simple, then upgrade as your usage, workflows, and team needs grow.
              Every plan includes the AI Office Launch Kit, free.
            </p>
          </div>
        </section>

        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <PricingPlans />
          </div>
        </section>

        {/* FULL FEATURE COMPARISON — every shipped feature per tier, mirrors tier-caps. */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <ComparisonMatrix />
          </div>
        </section>

        {/* MONEY MATH — the monthly cost of the busywork, anchored against $37/mo. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <MoneyMath />
          </div>
        </section>

        {/* PARTS VS PRODUCT — the concrete wedge: string the tools together, or use the Apps. */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <PartsVsProduct />
          </div>
        </section>

        {/* LAUNCH KIT HIGHLIGHT */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Every plan includes the AI Office Launch Kit — free.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
                Guided Business Brain setup · 3 prebuilt Personas · 5 workflow
                templates · the setup checklist · your first Mission Control
                review · the Skool community. It’s the difference between buying
                software and getting it running.
              </p>
              <div className="mt-5">
                <Link
                  href="/launch-kit"
                  className="text-sm font-semibold text-cyan-300 transition hover:underline"
                >
                  What’s in the Launch Kit →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* BUDGET HONESTY + GUARANTEE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="space-y-6 text-[15px] leading-relaxed text-slate-300">
              <p>
                <span className="text-slate-100">No “AI credits” to ration.</span>{" "}
                No surprise overages. Set a monthly cap; your agent pauses and
                asks before it crosses it.
              </p>
              <p>
                <span className="text-slate-100">Implementation Guarantee.</span>{" "}
                Complete the setup steps in your first 7 days, or we help you
                finish them. The only real risk with software like this is buying
                it and never getting it running — we took that off the table.
              </p>
            </div>
          </div>
        </section>

        {/* DOWNSELL */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <div
              className="mb-3 text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ not ready yet? ]
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Not ready for a subscription?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
              Run the workspace for 14 days for $97 — and the $97 comes off your
              subscription if you upgrade.
            </p>
            <div className="mt-6">
              <Link
                href="/downsell"
                className="inline-flex items-center justify-center rounded-full border border-accent/50 bg-accent/[0.04] px-7 py-3 text-sm font-semibold text-accent transition hover:scale-[1.02] hover:bg-accent/[0.08]"
              >
                See the $97 Pilot
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
