import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA } from "@/components/marketing/cta";
import { AgentsCompose } from "@/components/marketing/agents-compose";
import { AgentsLibraryExplorer } from "@/components/marketing/agents-library-explorer";
import { AGENTS_LIBRARY } from "@/data/agents-library";
import { buildComposeData } from "@/lib/marketing/compose-preview-data";

const PAGE_URL = "https://aipocketagent.com/agents";
const TITLE = "Agents Library — Every Ready-to-Run AI Agent in Pocket Agent";
const DESCRIPTION =
  "Browse every ready-to-run AI agent: lead scouts, follow-up sweeps, proposal drafters, research ingesters, ritual runners, and MVP shippers. Filter by industry and use case. Every agent drafts first — you approve what sends.";

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

export default function AgentsLibraryPage() {
  const composeData = buildComposeData();
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:pt-20">
          <p className="text-xs uppercase tracking-[0.2em] text-accent/80">The Agents Library</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Hiring is slow. Pick a worker off the shelf instead.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            {AGENTS_LIBRARY.length} ready-to-run agents, each built from the same parts —
            a Persona that does the work, the Apps it runs, and your Business Brain behind
            it. Every agent drafts first and stages the work for your approval. Nothing
            sends without you.
          </p>
        </section>

        {/* The create surface (PA-POS-34, amending PA-POS-27): the library below is the
            marketplace; this is where an agent that isn't on the shelf gets composed. A
            signed-in owner composes right here — every tier; the tier gate applies to the
            composed agent's Apps at review time. Signed out, the spec rides into signup. */}
        <section id="compose" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-10">
          <article
            data-agent-card="custom-agent-builder"
            className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-6 sm:p-8"
          >
            <div className="max-w-2xl">
              <span className="rounded-full border border-accent/30 bg-accent/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent">
                Custom Agent Builder
              </span>
              <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">
                The agent you need isn&apos;t on the shelf? Describe it.
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                Describe the agent you need — Pocket Agent composes it inside your workspace
                from the same Personas, Apps, and Skills every agent on this page is built
                from, and stages it for your approval before it runs. The agent lives in your
                Business Brain repo. Not our database.
              </p>
            </div>
            <div className="mt-5">
              <AgentsCompose composeData={composeData} />
            </div>
          </article>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <AgentsLibraryExplorer />
        </section>

        <section className="border-t border-white/5 bg-black/30">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:items-center sm:text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Every agent here comes with the workspace.
            </h2>
            <p className="max-w-xl text-slate-400">
              One subscription runs them all — the Personas, the Apps, the Approval Inbox,
              and the Business Brain they share. Start with one agent and add the rest when
              the work shows up.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
              <SecondaryCTA href="/pricing" label="See pricing" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
