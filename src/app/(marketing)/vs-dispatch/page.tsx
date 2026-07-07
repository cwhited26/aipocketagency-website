// /vs-dispatch — the ownership + business-brain-scope wedge (PA-POS-19). Dispatch is a
// well-built AI Chief of Staff backed by Martell Ventures (Dan Martell), and their ICP
// overlaps with PA's owner-led ICP. Two honest splits carry this page: their memory is
// contact-scoped and lives in their cloud; PA's is business-scoped and lives in your
// GitHub repo. Voice-checked against voice/chase-spec.md §10 and the no-AI-slop rule.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/vs-dispatch";
const TITLE = "Pocket Agent vs Dispatch — where your business context actually lives";
const DESCRIPTION =
  "Dispatch keeps a living memory of every contact. Pocket Agent keeps your entire Business Brain — voice, customers, products, decisions — in a GitHub repo you own.";

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

// Comparison rows. Row 3 (Meeting bot) reads "dispatch" on purpose — they shipped further
// there today. PA's Meeting Persona foundation is in place (Recall.ai + Deepgram) with the
// App surface pending per the Meeting Persona SPEC v1.3. Faking that row would break the
// bar the rest of the page runs on. The rows PA wins (Ownership, Memory model, Pricing,
// Cancellation) are the PA-POS-19 wedge and the business-brain-scope wedge — the moat no
// walled-garden vendor can copy without rewriting their business model.
const ROWS: ReadonlyArray<{
  label: string;
  sub: string;
  dispatch: string;
  pa: string;
  verdict: "pa" | "dispatch";
}> = [
  {
    label: "Ownership",
    sub: "Where your business context lives",
    dispatch: "In Dispatch's cloud, in Dispatch's memory model.",
    pa: "In your own GitHub repo, in your account. Every write is a commit.",
    verdict: "pa",
  },
  {
    label: "Memory model",
    sub: "What the agent actually remembers",
    dispatch: "Contact-scoped. A living profile per person you talk to.",
    pa: "Business-scoped. Voice, customers, products, competitive, decisions — the full Business Brain, not just contacts.",
    verdict: "pa",
  },
  {
    label: "Meeting bot, prep, debriefs",
    sub: "Agent joins the call and works with the transcript",
    dispatch: "Shipped. Bot joins calls, transcribes, feeds people profiles.",
    pa: "Foundation shipped — Recall.ai connector plus Deepgram streaming transcription. The full Meeting Persona App with prep dossiers and debriefs ships next per Meeting Persona SPEC v1.3.",
    verdict: "dispatch",
  },
  {
    label: "Pricing transparency",
    sub: "Whether you can see the price before you talk to a founder",
    dispatch: "Invite-only waitlist. No published pricing.",
    pa: "Transparent tiers — $37 Personal Brain, $97 Business Agent, $497 AI Agent Workspace. Self-serve.",
    verdict: "pa",
  },
  {
    label: "When you cancel",
    sub: "What happens to what the agent knew",
    dispatch: "Contact memory and meeting notes go with them.",
    pa: "Brain repo stays in your GitHub. Read it, edit it, point a different agent at it someday.",
    verdict: "pa",
  },
];

const PICK_DISPATCH: ReadonlyArray<string> = [
  "You're an established founder-operator who lives in email and meetings — no more, no less.",
  "You want white-glove onboarding by their founder and can wait through the waitlist.",
  "You care more about a Dan Martell-endorsed tool than about owning the underlying data.",
];

const PICK_PA: ReadonlyArray<string> = [
  "You run a business — customers, products, decisions, competitive positioning — not just an inbox.",
  "You care that your business context stays in an account you control.",
  "You want transparent pricing and a self-serve start without a founder call.",
  "You'd rather build a brain that outlives any single vendor.",
];

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Can I use both?",
    a: "Yes. Dispatch for the EA layer, Pocket Agent for the Business Brain layer. Nothing about PA blocks it, and your brain repo stays yours either way.",
  },
  {
    q: "Pocket Agent doesn't have a shipping meeting bot yet — is that a problem?",
    a: "Not for most owner-led businesses. The foundation is in place — Recall.ai connector plus Deepgram streaming transcription. If a meeting bot is your number-one criterion today, Dispatch may be the better fit today. Come back to PA when the Meeting Persona App lands.",
  },
  {
    q: "Is Pocket Agent backed by Dan Martell?",
    a: "No. Pocket Agent is founder-funded. Different distribution path.",
  },
  {
    q: "How is PA cheaper — is that a downgrade signal?",
    a: "PA is priced for owner-led businesses at scale, not just individual founders. Different pricing model for different fit.",
  },
  {
    q: "Are you affiliated with Dispatch?",
    a: "No. This is a public product comparison.",
  },
];

export default function VsDispatchPage() {
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
              [ pocket agent vs dispatch ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Pocket Agent vs Dispatch — where your business context actually lives
            </h1>
            <h2 className="mt-6 text-balance text-xl text-slate-300 sm:text-2xl">
              Dispatch keeps a living memory of every contact. Pocket Agent keeps your entire Business Brain — in a GitHub repo you own.
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Dispatch is one of the sharpest new AI Chief of Staff products, backed by Dan Martell. But their memory lives in their cloud. Pocket Agent&apos;s brain lives in your GitHub account, where you can read it, edit it, take it with you.
            </p>
          </div>
        </section>

        {/* What Dispatch does well — named, plainly */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div
              className="text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ credit up front ]
            </div>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight">
              What Dispatch does well.
            </h2>
            <p className="mt-5 text-slate-300">
              Dispatch is a well-built AI Chief of Staff. Morning briefings, meeting prep dossiers, contact profiles that auto-update from every interaction, and a meeting bot that transcribes calls. Slack, Telegram, and email as channels, with business-hours vs after-hours routing. Any MCP server on the connector side. A trust ladder that mirrors PA&apos;s Approval Inbox.
            </p>
            <p className="mt-4 text-slate-300">
              The team is well-funded through Martell Ventures — the exact distribution advantage that matters for founder-operators. Real product, real customers, real founder-touch onboarding.
            </p>
            <p className="mt-4 text-slate-300">
              This is not a hit piece. Dispatch is a serious product built by serious people. The rest of this page is the split — where the products actually differ, and what each one wins on that difference.
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
              Pocket Agent wins four rows on ownership and scope. Dispatch wins one row on the meeting bot they shipped further today. That&apos;s the honest split.
            </p>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[680px] text-left text-sm sm:text-base">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-6">
                      Row
                    </th>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-6">
                      Dispatch
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
                      <td className="px-4 py-5 text-slate-300 sm:px-6">{row.dispatch}</td>
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
                            className="inline-block rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            dispatch
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
              Who Dispatch is better for. Who Pocket Agent is better for.
            </h2>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-sm font-semibold text-slate-400">
                  Dispatch is the better call if
                </div>
                <ul className="mt-4 space-y-3 text-slate-200">
                  {PICK_DISPATCH.map((row) => (
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
              You own the brain. You rent the workers.
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
              Start your business brain.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              One repo. Your voice, your customers, your decisions. The workers read from it. You own it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/start"
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-6 py-3 text-base font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-300/20"
              >
                Start your business brain
              </Link>
              <Link
                href="/workshop"
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
              >
                See how the workshop fills your brain
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
