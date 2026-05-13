import type { Metadata } from "next";
import Link from "next/link";
import { retrieveCheckoutSession } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const SKOOL_URL = "https://www.skool.com/aipocketagency";
const APP_URL = "https://app.aipocketagency.com";

export function generateMetadata(): Metadata {
  return {
    title: "Welcome to Pocket Agent — trial active",
    description: "Your 14-day free trial is active. Set up your AI brain.",
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

  // Verify the session is real. Tolerate failures — the welcome copy
  // should never block on a Stripe network hiccup.
  let email: string | null = null;
  let trialEnd: string | null = null;
  let sessionValid = false;

  if (sessionId.startsWith("cs_")) {
    const lookup = await retrieveCheckoutSession(sessionId);
    if (lookup.ok) {
      sessionValid = true;
      email = lookup.session.customer_email;
      // Stripe doesn't surface trial_end directly on the session object;
      // the subscription trial is tracked in DB via the webhook. We can
      // derive the approximate end date from now + 14 days for display.
      const approxEnd = new Date();
      approxEnd.setDate(approxEnd.getDate() + 14);
      trialEnd = approxEnd.toISOString();
    }
  }

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
                Welcome to Pocket Agent.
              </span>
            </h1>

            {email && (
              <p className="mt-3 text-sm text-slate-400" style={{ fontFamily: MONO_FONT }}>
                {email}
              </p>
            )}

            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Your 14-day free trial is active. No charge until the trial ends.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {/* Step 1 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
              <div
                className="mb-3 text-xs uppercase tracking-wider text-cyan-400/70"
                style={{ fontFamily: MONO_FONT }}
              >
                step 1
              </div>
              <h2 className="text-lg font-semibold text-slate-100">
                Sign in and set up your brain
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Your AI brain lives in a git repo you own — file-based memory,
                multi-lane agents, no context wall. Sign in at the app to
                connect it to your stack.
              </p>
              <a
                href={APP_URL}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[0_0_40px_-12px_rgba(34,211,238,0.7)] transition hover:scale-[1.01]"
              >
                Open app.aipocketagency.com →
              </a>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
              <div
                className="mb-3 text-xs uppercase tracking-wider text-indigo-400/70"
                style={{ fontFamily: MONO_FONT }}
              >
                step 2
              </div>
              <h2 className="text-lg font-semibold text-slate-100">
                Join the Skool community
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Three live calls a week, the operators trading patterns weekly,
                and me in the room twice a week. Pocket Agent subscribers are in
                the same community.
              </p>
              <a
                href={SKOOL_URL}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Join the community →
              </a>
            </div>
          </div>

          {!sessionValid && sessionId && (
            <p className="mt-8 text-center text-xs text-slate-500">
              Could not verify your checkout session — but your subscription is
              recorded. Check your email for confirmation.
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
