import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/setup";
const DESCRIPTION =
  "Done-With-You Setup — we build your AI Agent Workspace, you go straight to working agents. Standard $997 / Premium $2,500. A productized service: your Business Brain built from your real business, your Personas configured, a workflow running, on a call with Chase.";

export const metadata: Metadata = {
  title: "Done-With-You Setup — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Done-With-You Setup — we build your workspace, you go straight to working agents.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
};

const TIERS: { name: string; price: string; rows: string[] }[] = [
  // Premium first — the anchor.
  {
    name: "Premium",
    price: "$2,500 one-time",
    rows: [
      "Everything in Standard",
      "We connect your email + context so the agent reads from day one",
      "We run your first Lead Scout sweep with you",
      "We build and run your first daily + weekly brief",
      "We run your first Follow-Up Sweep",
      "A 60-minute implementation call, with live output produced on the call",
      "A 30-day check-in call to tune what you’ve learned you need",
    ],
  },
  {
    name: "Standard",
    price: "$997 one-time",
    rows: [
      "We build your Business Brain from your real business — voice, customers, prices, processes",
      "We configure your 3 Personas (Admin / Sales Follow-Up / Content) to your actual jobs",
      "We set up one real workflow end to end",
      "A 30-minute implementation call to hand you the keys",
    ],
  },
];

export default function SetupPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-24">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              Done-With-You Setup — we build your workspace, you go straight to
              working agents.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              A productized service, not software. We do the setup the Launch Kit
              would have you do yourself — white-glove. You’ve got the workspace.
              Want us to build it for you?
            </p>
          </div>
        </section>

        {/* TWO TIERS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="grid gap-5 md:grid-cols-2">
              {TIERS.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7"
                >
                  <h2 className="text-lg font-semibold text-slate-100">
                    {t.name}
                  </h2>
                  <div className="mt-1 text-xl font-bold text-slate-200">
                    {t.price}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-300">
                    {t.rows.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <span className="mt-1 text-cyan-300">✓</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-400">
              If the setup call doesn’t leave you with a workspace that’s
              actually running your work, we keep working until it does. Reply,
              no form.
            </p>
          </div>
        </section>

        {/* WHO DELIVERS + WHAT YOU WALK AWAY WITH */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Who delivers it.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-300">
              Chase does every Done-With-You Setup himself for the first 20 — the
              revenue funds the build, and doing the first 20 by hand is how the
              playbook gets written. Every call surfaces what owners actually get
              stuck on, which feeds back into the Launch Kit and the community
              walkthroughs. After 20, it hands to a trained onboarding specialist
              or a templatized self-serve path.
            </p>

            <h2 className="mt-12 text-2xl font-bold tracking-tight sm:text-3xl">
              What happens on the call.
            </h2>
            <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-slate-300">
              <p>
                Before the call we send a short intake — your existing writing
                (for voice), your customer list, your pricing, and the one
                workflow you want first — so the call is spent building, not
                gathering. You’ll get a booking confirmation with exactly what
                we’ll have done by the end.
              </p>
              <p>
                <span className="text-slate-100">Standard:</span> the
                30-minute call leaves you with a Business Brain built from your
                real business, 3 configured Personas, one running workflow, and a
                Mission Control walkthrough so you can read the cockpit.
              </p>
              <p>
                <span className="text-slate-100">Premium:</span> the 60-minute
                call leaves you with all of that, plus connected tools the agent
                reads from, a completed first Lead Scout sweep, a live daily +
                weekly brief, a completed first Follow-Up Sweep, and a booked
                30-day check-in.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-2xl px-6 py-20 text-center">
            <div
              className="mb-4 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ offered right after you start ]
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Start your workspace, then add Done-With-You Setup.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
              The Setup is offered the moment you start a subscription — so we
              build on your real account. Start the workspace, and the offer’s
              waiting on the next screen.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/start?tier=studio_plus"
                className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.02]"
              >
                Start the workspace
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
