import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { AgentCard } from "@/components/marketing/agent-card";
import { PersonaChatShot } from "@/components/marketing/motion-shots/persona-chat-shot";
import { IdeaEngineShot } from "@/components/marketing/motion-shots/idea-engine-shot";
import { ApprovalInboxShot } from "@/components/marketing/motion-shots/approval-inbox-shot";
import { agentsForUseCase } from "@/data/agents-library";
import { otherUseCases } from "@/data/use-cases";

const PAGE_URL = "https://aipocketagent.com/use-cases/lead-generation";
const TITLE = "Lead Generation with AI Agents — Pocket Agent";
const DESCRIPTION =
  "Find your next 100 customers without becoming a data analyst. Lead Scout sweeps your market, scores the fit, and stages outreach drafts in your voice — you approve what sends. $37 a month to start.";

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

const HOW_IT_WORKS: { title: string; body: string }[] = [
  {
    title: "Pick a Lead Scout vertical pack",
    body: "Contractors, med spas, home services — each pack comes pre-tuned to how that market shows up online, so you start from a working sweep, not a blank form.",
  },
  {
    title: "Tell it who you sell to",
    body: "Titles, industries, geography — in plain words. The agent files it in your Business Brain and every future sweep starts from it.",
  },
  {
    title: "Connect your Gmail and your CRM",
    body: "Pocket Agent walks you through each connection step by step. No technical setup on your side.",
  },
  {
    title: "It finds, scores, and stages",
    body: "The agent sweeps your market, scores each prospect against your ideal customer, and stages outreach drafts in your voice — in the Approval Inbox, waiting on you.",
  },
];

const CAPABILITIES: { name: string; body: string }[] = [
  { name: "Personas", body: "The workers — each one a role you'd otherwise hire." },
  { name: "Apps", body: "The workflows they run: sweeps, drafts, briefs, builds." },
  { name: "Skills", body: "The techniques they follow, written down and repeatable." },
  { name: "Business Brain", body: "Your memory, in a GitHub account you own — GitHub is free and Pocket Agent walks you through it." },
  { name: "Mission Control", body: "One screen showing everything your agents did and why." },
  { name: "Approval Inbox", body: "Every draft waits here for your tap. Nothing sends itself." },
  { name: "Channels", body: "Reach your agent from Slack, text, or WhatsApp — same memory." },
  { name: "Cost Ledger", body: "Every dollar of agent spend, itemized. No surprise bills." },
  { name: "Ritual Scheduler", body: "Say it once — 'every Monday at 8' — and it runs for good." },
];

export default function LeadGenerationPage() {
  const agents = agentsForUseCase("lead-generation", 6);
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-14 pt-16 sm:pt-24">
          <p className="text-xs uppercase tracking-[0.2em] text-accent/80">
            Use case · Lead generation
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Find your next 100 customers without becoming a data analyst.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            The leads exist. The problem is the hours — the searching, the list-building,
            the first email you never get around to writing. Pocket Agent&apos;s lead
            agents do that part, then stage every draft for your approval.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
            <SecondaryCTA href="/agents" label="Browse the full agent library" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="text-2xl font-semibold tracking-tight">Ready-to-use agents</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Six lead agents, ready on day one. Each one drafts first — you approve what sends.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.slug} agent={a} />
            ))}
          </div>
        </section>

        <section className="border-t border-white/5 bg-black/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title} data-how-step={i + 1}>
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-sm font-bold text-accent ring-1 ring-accent/30"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Built on Pocket Agent</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            This is the workspace under every agent — watch it work. Your memory lives in
            your own GitHub account, not our database. Cancel tomorrow and the brain is
            still yours.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <PersonaChatShot />
            <IdeaEngineShot />
            <ApprovalInboxShot />
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <div
                key={c.name}
                className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5"
              >
                <span className="text-[13px] font-semibold text-slate-100">{c.name}</span>
                <p className="mt-1 text-[13px] leading-snug text-slate-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TODO(chase): real customer quotes when available — these cards ship as honest
            placeholders, no invented names, no composite testimony (PA-POS-13). */}
        <section className="border-t border-white/5 bg-black/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-2xl font-semibold tracking-tight">What owners say</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {["Owner, contracting company", "Founder, coaching practice", "Principal, agency"].map(
                (attribution) => (
                  <figure
                    key={attribution}
                    className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5"
                  >
                    <blockquote className="text-sm italic leading-relaxed text-slate-500">
                      A real customer&apos;s words land here when they sign off. We don&apos;t
                      invent quotes.
                    </blockquote>
                    <figcaption
                      className="mt-4 text-[11px] uppercase tracking-wider text-slate-600"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {attribution}
                    </figcaption>
                  </figure>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 sm:items-center sm:text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to automate the hunt?</h2>
          <p className="max-w-xl text-slate-400">
            Start with one lead agent. Add the rest of the library when the pipeline fills.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
            <SecondaryCTA href="/agents" label="Browse the full agent library" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {otherUseCases("lead-generation").map((u) => (
              <Link
                key={u.slug}
                href={`/use-cases/${u.slug}`}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-slate-400 transition hover:border-accent/40 hover:text-accent"
              >
                {u.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
