// /vs-twin — the ownership-story wedge (PA-POS-19). Distinct from /compare/twin: this page
// is a durable SEO play for "twin.so alternative" and "twin vs pocket agent" search traffic
// while the window is open (Twin runs Cowork-comparison ads without naming PA). Sharpened
// around the one line that decides it — the brain repo lives in your GitHub, not either
// vendor's cloud. Voice-checked against voice/chase-spec.md §10 and the no-AI-slop rule.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/vs-twin";
const TITLE = "Pocket Agent vs Twin — where your business brain actually lives";
const DESCRIPTION =
  "Twin stores your memory in their cloud. Pocket Agent puts your Business Brain in your own GitHub — a repo you keep even if you cancel. That's the one line that decides it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
    images: ["/og-share.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-share.png"],
  },
};

// Comparison rows. Two verdicts read "parity" on purpose — Twin ships channels and model
// choice, PA ships the same. Faking either row would break the bar the rest of the page
// runs on. The rows PA wins (Ownership, Memory audit trail, After you cancel) are the
// PA-POS-19 wedge — the moat no walled-garden vendor can copy without rewriting their
// business model.
const ROWS: ReadonlyArray<{
  label: string;
  sub: string;
  twin: string;
  pa: string;
  verdict: "pa" | "parity";
}> = [
  {
    label: "Ownership",
    sub: "Where your business context lives",
    twin: "In Twin's cloud, on Twin's file system.",
    pa: "In your own GitHub repo, in your account.",
    verdict: "pa",
  },
  {
    label: "Channels",
    sub: "Where your team messages the agent",
    twin: "Slack, Teams, WhatsApp, Gmail.",
    pa: "Slack, SMS, iMessage, WhatsApp, Telegram, web widget.",
    verdict: "parity",
  },
  {
    label: "Model choice",
    sub: "Which LLM the agent runs on",
    twin: "Model-agnostic.",
    pa: "BYO LLM dispatcher on Studio+ ($497). Same idea.",
    verdict: "parity",
  },
  {
    label: "Memory audit trail",
    sub: "How you inspect what the agent remembered",
    twin: "Black-box compounds inside Twin's cloud. No commit history you can open.",
    pa: "Every write to your brain is a git commit. Open any file, inspect any decision, roll back if something's wrong. Standard git.",
    verdict: "pa",
  },
  {
    label: "When you cancel",
    sub: "What happens to the memory",
    twin: "Your memory goes with them.",
    pa: "Your brain repo is still in your GitHub account. Read it, keep using it, or point a different agent at it later. Yours forever.",
    verdict: "pa",
  },
];

const PICK_TWIN: ReadonlyArray<string> = [
  "You'd rather not touch GitHub at all — Twin's abstraction over that is cleaner.",
  "You want a team-shared searchable memory that isn't yours to own but is easier to search.",
  "Model-agnostic + no plumbing is your top criterion, and ownership isn't.",
];

const PICK_PA: ReadonlyArray<string> = [
  "You care that your business context stays in an account you control.",
  "You want to see the audit trail of every decision your agent made.",
  "You'd rather pay $37, $97, or $497 for a repo you'd keep even if Pocket Agent disappeared than pay for memory that vanishes when you cancel.",
];

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Isn't Twin's approach easier since I don't touch GitHub?",
    a: "Yes. Easier to start. Not the same thing as yours to keep — those are two different bars, and this page is about the second one. If day-one simplicity is your only bar, Twin wins that row and we won't pretend otherwise.",
  },
  {
    q: "Can I use both?",
    a: "Yes. Nothing about Pocket Agent blocks you from also using Twin. Your brain repo stays yours either way, and either agent can read from it if you point it at the files.",
  },
  {
    q: "What if I don't have a GitHub account yet?",
    a: "Pocket Agent walks you through it during the Business Brain Workshop. About a minute — about as easy as making a Facebook account. It's free.",
  },
  {
    q: "How is this different from Claude Cowork?",
    a: "Cowork is a Claude product for general agent work — a chat surface with tools. Pocket Agent is a business-specific agent workspace plus a Business Brain in a GitHub repo you own. Different problem, different shape.",
  },
  {
    q: "Are you affiliated with Twin?",
    a: "No. This is a public product comparison.",
  },
];

export default function VsTwinPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-24">
            <div
              className="mb-4 text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pocket agent vs twin ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Pocket Agent vs Twin — one line that decides it
            </h1>
            <h2 className="mt-6 text-balance text-xl text-slate-300 sm:text-2xl">
              Your business brain lives in your own GitHub. Not in Twin&apos;s cloud. Not in ours.
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              When Twin churns you, your memory goes with them. When Pocket Agent churns you, your brain is still sitting in your GitHub account. That&apos;s the whole difference.
            </p>
          </div>
        </section>

        {/* What Twin does well — named, plainly */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div
              className="text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ credit up front ]
            </div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight">
              What Twin does well.
            </h2>
            <p className="mt-5 text-slate-300">
              Twin ships fast. Model-agnostic. Connects to public APIs. Drops into Slack, Teams, WhatsApp, and Gmail so anyone on the team can message it. Organizes memory as a shared searchable file system. Well-funded team out of Paris, real product, real customers.
            </p>
            <p className="mt-4 text-slate-300">
              This is not a hit piece. Twin is a serious product built by serious people. The rest of this page is the split — where the products actually differ, and what each one wins on that difference.
            </p>
          </div>
        </section>

        {/* Comparison table — 5 rows */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div
              className="text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ the split ]
            </div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight">
              Five rows, side by side.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-300">
              Twin wins some rows. Pocket Agent wins some rows. Two rows are parity, and we won&apos;t pretend otherwise.
            </p>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[680px] text-left text-sm sm:text-base">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-6">
                      Row
                    </th>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-6">
                      Twin
                    </th>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-6">
                      Pocket Agent
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-right font-semibold sm:px-6"
                    >
                      Verdict
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ROWS.map((row) => (
                    <tr key={row.label} className="align-top">
                      <th
                        scope="row"
                        className="px-4 py-5 font-semibold text-slate-100 sm:px-6"
                      >
                        <div>{row.label}</div>
                        <div className="mt-1 text-xs font-normal text-slate-500">
                          {row.sub}
                        </div>
                      </th>
                      <td className="px-4 py-5 text-slate-300 sm:px-6">{row.twin}</td>
                      <td className="px-4 py-5 text-slate-100 sm:px-6">{row.pa}</td>
                      <td className="px-4 py-5 text-right sm:px-6">
                        {row.verdict === "pa" ? (
                          <span
                            className="inline-block rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            pa
                          </span>
                        ) : (
                          <span
                            className="inline-block rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-300"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            parity
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-10 text-balance text-center text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
              Your business brain is not a feature we own. It&apos;s a repo you own.
            </p>
          </div>
        </section>

        {/* Who each product is better for — plainly */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div
              className="text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pick the right one ]
            </div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight">
              Who Twin is better for. Who Pocket Agent is better for.
            </h2>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-sm font-semibold text-slate-400">
                  Twin is probably the better call if
                </div>
                <ul className="mt-4 space-y-3 text-slate-200">
                  {PICK_TWIN.map((row) => (
                    <li key={row} className="flex gap-3">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500"
                        aria-hidden
                      />
                      <span>{row}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
                <div className="text-sm font-semibold text-cyan-200">
                  Pocket Agent is the better call if
                </div>
                <ul className="mt-4 space-y-3 text-slate-100">
                  {PICK_PA.map((row) => (
                    <li key={row} className="flex gap-3">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                        aria-hidden
                      />
                      <span>{row}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-10 text-balance text-center text-lg text-slate-300">
              You own the stack. You rent the workers.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div
              className="text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ faq ]
            </div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight">
              Five questions people ask.
            </h2>
            <dl className="mt-8 space-y-6">
              {FAQ.map((row) => (
                <div
                  key={row.q}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <dt className="text-lg font-semibold text-slate-100">{row.q}</dt>
                  <dd className="mt-2 text-slate-300">{row.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Soft CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              Start the brain that stays with you.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              The workshop is the fastest way to see one filled with real business context. Or start yours in the workspace and go.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/workshop"
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-6 py-3 text-base font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-300/20"
              >
                See how the workshop fills your brain
              </Link>
              <Link
                href="/start"
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
              >
                Start your brain
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
