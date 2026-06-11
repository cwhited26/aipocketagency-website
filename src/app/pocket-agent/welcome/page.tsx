import type { Metadata } from "next";
import Link from "next/link";
import { SKOOL_URL } from "@/lib/constants/skool";
import { createClient } from "@/lib/supabase/server";
import { retrieveCheckoutSession } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export function generateMetadata(): Metadata {
  return {
    title: "Your trial is live — Pocket Agent | AI Pocket Agency",
    description: "Get your first useful answer from Pocket Agent in the next 10 minutes.",
    robots: { index: false, follow: false },
  };
}

function TrialBadge({ trialEnd }: { trialEnd: string | null }) {
  const label = trialEnd
    ? `Trial ends ${new Date(trialEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`
    : "14-day free trial active";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-sm text-cyan-300"
      style={{ fontFamily: MONO_FONT }}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-400" />
      {label}
    </div>
  );
}

export default async function PocketAgentWelcomePage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams?.session_id ?? "";

  let email: string | null = null;
  let trialEnd: string | null = null;
  let sessionValid = false;

  if (sessionId.startsWith("cs_")) {
    const lookup = await retrieveCheckoutSession(sessionId);
    if (lookup.ok) {
      sessionValid = true;
      email = lookup.session.customer_email;
      const approxEnd = new Date();
      approxEnd.setDate(approxEnd.getDate() + 14);
      trialEnd = approxEnd.toISOString();
    }
  }

  // If the user already has a session, send them straight to the app.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const steps = [
    isLoggedIn
      ? "You're signed in — your account is active."
      : "Sign in with GitHub or your email to activate your Pocket Agent.",
    "Build your brain — one click forks the brain template, then six quick questions fill in your business context. Your agent reads this before every answer.",
    "Add your Anthropic API key in Settings so your agent can think. It stays on our server, never in your browser.",
    "Try a Work app — use the Quote/Proposal Writer or Email Drafter to get a draft in your voice, from your own files.",
    "Level 1: your agent knows your business. Level 2: it drafts in your voice. Level 3: it acts in your tools.",
  ];

  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />

        <div className="relative mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="text-center">
            <div className="flex justify-center">
              <TrialBadge trialEnd={trialEnd} />
            </div>

            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                Your trial is live. Get your first useful answer in 10 minutes.
              </span>
            </h1>

            {email && (
              <p className="mt-3 text-sm text-slate-400" style={{ fontFamily: MONO_FONT }}>
                {email}
              </p>
            )}

            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Follow these five steps to get set up:
            </p>
          </div>

          <ol className="mt-10 space-y-3">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
              >
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {i + 1}
                </span>
                <span className="text-base leading-relaxed text-slate-200 sm:text-lg">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col gap-4">
            {isLoggedIn ? (
              <a
                href="/app/ask"
                className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-12px_rgba(34,211,238,0.7)] transition hover:scale-[1.01]"
              >
                Open Pocket Agent →
              </a>
            ) : (
              <a
                href="/app/login"
                className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-12px_rgba(34,211,238,0.7)] transition hover:scale-[1.01]"
              >
                Create your account →
              </a>
            )}
            <a
              href={SKOOL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-6 py-4 text-base font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Join the Skool community →
            </a>
          </div>

          {!sessionValid && sessionId && (
            <p className="mt-8 text-center text-xs text-slate-500">
              Could not verify your checkout — but your trial is recorded. Check
              your email for confirmation.
            </p>
          )}

          <div className="mt-10 text-center">
            <Link
              href="/pocket-agent"
              className="text-sm text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
            >
              ← Back to Pocket Agent
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
