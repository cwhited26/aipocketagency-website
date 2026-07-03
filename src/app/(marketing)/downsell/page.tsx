import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-nav";
import DownsellForm from "./DownsellForm";

const PAGE_URL = "https://aipocketagent.com/downsell";

export const metadata: Metadata = {
  title: "Run the workspace for 14 days. $97. — Pocket Agent",
  description:
    "Not ready for a subscription? The $97 14-day AI Agent Workspace Pilot: a Business Brain starter, one Persona, one workflow, one Mission Control review. The $97 credits toward your subscription if you upgrade.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

const INCLUDES = [
  "A Business Brain starter — set up from your real business",
  "1 Persona — pick the worker burying you most (Admin, Sales, or Content)",
  "1 workflow — one real job, set up and running",
  "1 Mission Control review — we walk you through reading the cockpit",
  "The $97 credits toward your subscription if you upgrade inside the 14 days",
];

export default function DownsellPage() {
  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-20 text-center sm:pt-24">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              Not ready for a subscription? Run the workspace for 14 days. $97.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              A subscription’s a commitment, and you haven’t seen it work on your
              business yet. Fair. So here’s the smaller step: $97, 14 days, the
              real workspace on your real business. If you upgrade after, the $97
              comes off your first subscription — so it costs you nothing extra
              to try it first.
            </p>
          </div>
        </section>

        <section className="border-b border-white/5">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-7">
              <h2 className="text-lg font-semibold text-slate-100">
                The 14-day AI Agent Workspace Pilot — $97
              </h2>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                {INCLUDES.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 text-cyan-300">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center">
              <DownsellForm />
              <p className="mt-5 text-xs leading-relaxed text-slate-500">
                After payment confirms, we provision your 14-day pilot workspace
                and email you the next step.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-[15px] leading-relaxed text-slate-300">
              <p>
                I’m pricing the pilot at $97 instead of giving it away free
                because a free trial you didn’t pay for is a free trial you don’t
                run — and the whole point is you actually see it work on your
                business. $97 gets you skin in the game and a real workspace, and
                it comes straight back off your subscription if you stay. If
                that’s not the right shape for you, no hard feelings — close the
                tab. If it is, the button’s above.
              </p>
              <p className="mt-4 text-right text-sm text-slate-500">— Chase</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
