import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retrieveCheckoutSession } from "@/lib/stripe-checkout";
import { SKOOL_PRICING, getKitConfig, isKitSlug } from "@/lib/kit-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const SKOOL_URL = "https://www.skool.com/aipocketagency";

export function generateMetadata(): Metadata {
  return {
    title: "One last thing — AI Pocket Agency community | $47/mo founding 50",
    description:
      "Three live calls a week, the kits get refreshed monthly, me in the room twice a week. Founding 50 locked at $47/mo for life.",
    robots: { index: false, follow: false },
  };
}

export default async function SkoolInvitePage({
  params,
  searchParams,
}: {
  params: { session_id: string };
  searchParams: { bundled?: string; origin?: string };
}) {
  const sessionId = params.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    notFound();
  }

  // We tolerate session retrieval failures here — the Skool pitch shouldn't
  // block on Stripe. We use the session only to enrich the success copy.
  const lookup = await retrieveCheckoutSession(sessionId);
  const session = lookup.ok ? lookup.session : null;

  const bundled = searchParams?.bundled === "1";
  const originSessionId = searchParams?.origin?.trim() || sessionId;

  // If we came from /upsell-bundle, the buyer either skipped or bundled. The
  // primary kit slug lives on the ORIGINAL session, not the bundle delta one.
  let originKitSlug = session?.metadata?.kit_slug ?? null;
  if (bundled && searchParams?.origin) {
    const originLookup = await retrieveCheckoutSession(originSessionId);
    if (originLookup.ok) {
      originKitSlug = originLookup.session.metadata?.kit_slug ?? null;
    }
  }
  const primaryKit =
    originKitSlug && isKitSlug(originKitSlug) ? getKitConfig(originKitSlug) : null;

  // Where the "skip" link drops them — the kit-success page for what they
  // already paid for. If we have neither origin nor session metadata, fall
  // back to home.
  const skipHref = primaryKit
    ? `/${primaryKit.slug}/success?session_id=${encodeURIComponent(originSessionId)}${bundled ? "&bundled=1" : ""}`
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
              [ founding-50 · {SKOOL_PRICING.offerUsd}/mo · open ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                One last thing.
              </span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300 sm:text-xl">
              These kits make 10x more sense when you&apos;re actually applying
              them with operators who are running the same playbook. Join the
              AI Pocket Agency community — three live calls per week, the kits
              get refreshed monthly, and you get me in the room twice a week.
            </p>
          </div>

          {/* IMAGE-SLOT: 1200×675, Skool community card — replace dashed-border placeholder with <Image src="/funnel-images/skool-community-card.png" .../> when Chase delivers (see public/funnel-images/README.md) */}
          <div className="mt-10 aspect-[16/9] w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-center text-slate-500 text-sm">
            <div className="text-center">
              <div className="font-semibold text-slate-400">
                Placeholder: skool-community-card.png
              </div>
              <div className="mt-1 text-xs">
                1200×675 · Skool community classroom card
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_0_60px_-25px_rgba(99,102,241,0.55)] sm:p-9">
            <div className="space-y-3 text-base leading-relaxed text-slate-200">
              <p>
                Three live calls per week with operators running this in
                production.
              </p>
              <p>
                The kits get refreshed monthly as Claude, Cursor, and Codex
                ship breaking changes — community members get the new versions
                included.
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
                <span className="text-slate-500 line-through">
                  ${SKOOL_PRICING.anchorUsd}/mo
                </span>
                <span className="text-2xl font-extrabold text-accent">
                  ${SKOOL_PRICING.offerUsd}/mo
                </span>
                <span className="text-sm text-slate-400">
                  founding-50 rate
                </span>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-slate-300">
                Locked at this rate forever — even after the dashboard ships
                and new members come in at ${SKOOL_PRICING.anchorUsd}/mo.
              </div>
              <div className="mt-3 text-sm text-slate-300">
                <span className="font-semibold text-accent">
                  {SKOOL_PRICING.spotsRemaining} of {SKOOL_PRICING.foundingSpots}
                </span>{" "}
                founding-member spots remaining.
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Cancel anytime. The first live call this week is Wednesday.
              </div>
            </div>

            <div className="mt-8">
              <a
                href={SKOOL_URL}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_50px_-12px_rgba(34,211,238,0.8)] transition hover:scale-[1.01] hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.95)] sm:text-lg"
              >
                Join the founding 50 — ${SKOOL_PRICING.offerUsd}/mo →
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
