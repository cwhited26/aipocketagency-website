import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/thanks";

export const metadata: Metadata = {
  title: "You’re in — Pocket Agent",
  description: "Your next step into your AI Agent Workspace.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

type Branch =
  | "subscription_only"
  | "subscription_plus_setup"
  | "pilot"
  | "workflow_vault"
  | "diy_setup_kit";

function isBranch(value: string | undefined): value is Branch {
  return (
    value === "subscription_only" ||
    value === "subscription_plus_setup" ||
    value === "pilot" ||
    value === "workflow_vault" ||
    value === "diy_setup_kit"
  );
}

const COPY: Record<
  Branch,
  { heading: string; body: string; steps: string[]; cta: { href: string; label: string } }
> = {
  subscription_only: {
    heading: "You’re in. Your workspace is live.",
    body: "Your trial just started. The AI Office Launch Kit is waiting in your workspace — it’s the guided path from empty workspace to working agents in your first week. Start with the Business Brain setup; everything else builds on it.",
    steps: [
      "Open your workspace and run the Business Brain setup.",
      "Put a Persona to work — get your first email draft and daily brief.",
      "Connect your first tool, then read your first Mission Control review.",
    ],
    cta: { href: "/launch-kit", label: "See your first week" },
  },
  subscription_plus_setup: {
    heading: "Done. We’re building it for you.",
    body: "You’ve got the workspace and the Done-With-You Setup. Next step is the call — we’ll email you a booking link and a short intake so the call is spent building, not gathering. By the end of it you’ll have a workspace that’s actually running your work.",
    steps: [
      "Watch your inbox for the booking link + intake form.",
      "Send us your existing writing (for voice), your customer list, and your pricing.",
      "Pick the one workflow you want set up first.",
    ],
    cta: { href: "/setup", label: "What we’ll deliver on the call" },
  },
  pilot: {
    heading: "Your 14-day Pilot is live.",
    body: "You’ve got a real workspace on your real business for the next 14 days: a Business Brain starter, one Persona, one workflow, and a Mission Control review. The $97 comes off your subscription if you upgrade inside the 14 days.",
    steps: [
      "Open your workspace and run the Business Brain setup.",
      "Put your one Persona on the job that’s burying you most.",
      "Watch your first workflow run, then read the cockpit with us.",
    ],
    cta: { href: "/pricing", label: "See the full plans" },
  },
  workflow_vault: {
    heading: "All 25 workflows are unlocked.",
    body: "The AI Workflow Vault is open on your account. Quote follow-ups, a dormant-lead sweep, your morning brief, content repurposing, lead research — install any of them with one tap and put a Persona on each. Every recipe brings back a draft you approve.",
    steps: [
      "Open the Workflow Vault from your Apps.",
      "Pick a recipe and choose which Persona runs it.",
      "Approve the first draft it brings back.",
    ],
    cta: { href: "/app/apps/workflow-vault", label: "Open the Vault" },
  },
  diy_setup_kit: {
    heading: "Your DIY Setup Kit is on its way.",
    body: "Check your email for the download link. Inside: the Business Brain upload checklist, the Mission Control review, the 7-day setup plan, setup templates for your three starter Personas, 25 workflow prompts, and an import-ready file you drop in when you sign up.",
    steps: [
      "Open the download link in your inbox (good for 24 hours).",
      "Work the 7-day plan and gather your brain materials.",
      "Import the bundle when you start your subscription.",
    ],
    cta: { href: "/pricing", label: "See the full plans" },
  },
};

export default function ThanksPage({
  searchParams,
}: {
  searchParams: { bought?: string };
}) {
  const branch: Branch = isBranch(searchParams.bought)
    ? searchParams.bought
    : "subscription_only";
  const c = COPY[branch];

  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-24 text-center sm:pt-32">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              {c.heading}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              {c.body}
            </p>

            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
              <ol className="space-y-3">
                {c.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-300"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-9 flex flex-col items-center gap-4">
              <PrimaryCTA href="/app" label="Open your workspace" />
              <Link
                href={c.cta.href}
                className="text-sm font-semibold text-cyan-300 transition hover:underline"
              >
                {c.cta.label} →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
