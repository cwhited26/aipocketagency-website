import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";
import { createClient } from "@/lib/supabase/server";
import { retrieveCheckoutSession } from "@/lib/stripe-session";
import ThanksLogin from "./ThanksLogin";
import ThanksAgentIdea from "./ThanksAgentIdea";

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
    heading: "Your Pocket Agent workspace is ready.",
    body: "Your trial just started. Don’t try to build everything at once — work the five steps below in order. Set up your Business Brain first; everything else builds on it.",
    steps: [
      "Set up your Business Brain — your company memory in markdown, in your own git repo.",
      "Join the Pocket Agent Launchpad on Skool — the 7-Day Setup Plan and walkthroughs.",
      "Create your first Persona — Admin Assistant, Follow-Up Agent, or Content Creator.",
      "Install your first workflow — Email Drafting, Follow-Up Sweeps, Capture Inbox, or Lead Scout. One, not ten.",
      "Open Mission Control — review what was captured, drafted, researched, and prepared.",
    ],
    cta: { href: "/launch-kit", label: "See your first week" },
  },
  subscription_plus_setup: {
    heading: "Done. We’re building it with you.",
    body: "You’ve got the workspace and the Done-With-You Setup. Next step is the call — we’ll email you a booking link and a short intake so the call is spent building, not gathering. We help with your Business Brain import, your first Persona, your first workflow, and your Mission Control review, with live output produced on the call.",
    steps: [
      "Watch your inbox for the booking link + intake form.",
      "Send us your existing writing (for voice), your customer list, and your pricing.",
      "Start your private setup thread inside the Pocket Agent Launchpad.",
      "Pick the one workflow you want set up first.",
    ],
    cta: { href: "/setup", label: "What we’ll deliver on the call" },
  },
  pilot: {
    heading: "Your 14-day Pilot starts now.",
    body: "You’ve got a real workspace on your real business for the next 14 days. The Pilot goal is simple: 1 Business Brain starter, 1 Persona, 1 workflow, 1 Mission Control review. Start with the Pilot Track inside the Pocket Agent Launchpad. The $97 comes off your subscription if you upgrade within 30 days.",
    steps: [
      "Open the Pilot Track inside the Pocket Agent Launchpad.",
      "Set up your Business Brain starter and put your one Persona on the job burying you most.",
      "Run your one workflow, then read the cockpit in Mission Control.",
    ],
    cta: { href: "/pricing", label: "See the full plans" },
  },
  workflow_vault: {
    heading: "All 25 workflows are ready.",
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

// Subscription branches are the ones that provision a workspace to log into (a pay-first buyer only
// reaches these). The add-on branches — workflow_vault (existing account) and diy_setup_kit (no
// account) — keep their original terminal copy with no login panel.
function isSubscriptionBranch(branch: Branch): boolean {
  return (
    branch === "subscription_only" ||
    branch === "subscription_plus_setup" ||
    branch === "pilot"
  );
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: { bought?: string; session_id?: string };
}) {
  const branch: Branch = isBranch(searchParams.bought)
    ? searchParams.bought
    : "subscription_only";
  const c = COPY[branch];

  // Pay-first, log in after: an unauthenticated buyer on a subscription branch gets the prominent
  // login panel. The webhook already created their account and emailed a login link; the panel points
  // them at their inbox and offers a resend, pre-filled with the checkout email when we can read it
  // back from Stripe. A buyer who was already signed in before checkout sees the normal welcome.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authenticated = Boolean(user);

  const showLogin = isSubscriptionBranch(branch) && !authenticated;
  let loginEmail = "";
  if (showLogin && searchParams.session_id) {
    const summary = await retrieveCheckoutSession(searchParams.session_id);
    if (summary.ok && summary.session.email) {
      loginEmail = summary.session.email;
    }
  }

  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-24 text-center sm:pt-32">
            {showLogin ? <ThanksLogin email={loginEmail} /> : null}
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              {c.heading}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              {c.body}
            </p>

            {/* The agent the buyer described before signup — picked up client-side so the
                paywall finishes what they started (agent-builder intent carry). */}
            {isSubscriptionBranch(branch) ? <ThanksAgentIdea /> : null}

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
              <PrimaryCTA href="/app/home" label="Open your workspace" />
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
