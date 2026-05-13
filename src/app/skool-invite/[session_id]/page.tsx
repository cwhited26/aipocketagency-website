import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retrieveCheckoutSession } from "@/lib/stripe-checkout";
import { getKitConfig, isKitSlug } from "@/lib/kit-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export function generateMetadata(): Metadata {
  return {
    title: "One last thing — Pocket Agent | AI Pocket Agency",
    description:
      "The software that runs all of this. $97/mo, 14-day free trial, Skool community included.",
    robots: { index: false, follow: false },
  };
}

export default async function SkoolInvitePage({
  params,
  searchParams,
}: {
  params: { session_id: string };
  searchParams: { bundled?: string };
}) {
  const sessionId = params.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    notFound();
  }

  // We tolerate session retrieval failures here — the Skool pitch shouldn't
  // block on Stripe. We use the session only to enrich the success copy
  // and pick the right "skip" destination.
  const lookup = await retrieveCheckoutSession(sessionId);
  const session = lookup.ok ? lookup.session : null;

  // The inline-funnel flow means there's exactly ONE Stripe session per
  // checkout — `?bundled=1` is set by the success_url on bundle sessions
  // and absent on kit / kit+pair sessions. We also fall back to the
  // session metadata `funnel_stage` so a missing query param doesn't break
  // the copy.
  const bundled =
    searchParams?.bundled === "1" ||
    session?.metadata?.funnel_stage === "bundle_upgrade";

  const kitSlug =
    session?.metadata?.kit_slug ??
    session?.metadata?.source ??
    session?.metadata?.origin_kit_slug ??
    null;
  const primaryKit =
    kitSlug && isKitSlug(kitSlug) ? getKitConfig(kitSlug) : null;

  const skipHref = primaryKit
    ? `/${primaryKit.slug}/success?session_id=${encodeURIComponent(sessionId)}${bundled ? "&bundled=1" : ""}`
    : "/";

  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pocket agent · $97/mo · 14-day free trial ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                One last thing.
              </span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300 sm:text-xl">
              The kits you just bought are the install layer. Pocket Agent is
              the software that runs them — connected to GitHub, brain live in
              minutes, every kit pre-installed. Skool community included with
              your subscription: three live calls per week, build sessions with
              me, operators running the same playbook.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
            <Image
              src="/funnel-images/skool-community-card.png"
              alt="AI Pocket Agency Skool community — founding-50 cohort, three live calls per week"
              width={1200}
              height={675}
              priority
              className="block w-full h-auto"
            />
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_0_60px_-25px_rgba(99,102,241,0.55)] sm:p-9">
            <div className="space-y-3 text-base leading-relaxed text-slate-200">
              <p>
                Three live calls per week with builders running this in
                production.
              </p>
              <p>
                The kits get refreshed monthly as Claude, Cursor, and Codex
                ship breaking changes — members get new versions
                automatically.
              </p>
              <p>I&apos;m in the room twice a week.</p>
            </div>

            <div
              className="mt-8 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5"
              style={{ fontFamily: MONO_FONT }}
            >
              <div className="text-xs uppercase tracking-wider text-slate-400">
                pricing
              </div>
              <div className="mt-2 flex items-baseline gap-3 text-base">
                <span className="text-2xl font-extrabold text-accent">
                  $97/mo
                </span>
                <span className="text-sm text-slate-400">
                  Pocket Agent — Skool included
                </span>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-slate-300">
                14-day free trial. Card collected at signup, nothing charges
                until day 15. Cancel before then and you pay nothing.
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Cancel anytime. Skool access comes with the subscription.
              </div>
            </div>

            <div className="mt-8">
              <a
                href="https://app.aipocketagency.com/signup"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_50px_-12px_rgba(34,211,238,0.8)] transition hover:scale-[1.01] hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.95)] sm:text-lg"
              >
                Start your 14-day free trial — $97/mo →
              </a>
              <div className="mt-4 text-center">
                <Link
                  href={skipHref}
                  className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                >
                  No thanks, just give me my{" "}
                  {bundled ? "kits" : "kit"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
