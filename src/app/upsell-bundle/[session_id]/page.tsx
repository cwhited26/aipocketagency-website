import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retrieveCheckoutSession } from "@/lib/stripe-checkout";
import {
  BUNDLE_PRICING,
  KIT_RETAIL_USD,
  BUMP_USD,
  KIT_CONFIG,
  getKitConfig,
  isKitSlug,
  type KitSlug,
} from "@/lib/kit-config";
import BundleUpgradeButton from "./BundleUpgradeButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export function generateMetadata(): Metadata {
  return {
    title: "One more thing — APA Kit Bundle | AI Pocket Agency",
    description:
      "All five APA kits, packaged once. $47 — anchor $97. This price isn't shown anywhere else on the site.",
    robots: { index: false, follow: false },
  };
}

function dollarsFromCents(cents: number | null): number {
  if (!cents || !Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export default async function UpsellBundlePage({
  params,
  searchParams,
}: {
  params: { session_id: string };
  searchParams: { cancelled?: string };
}) {
  const sessionId = params.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    notFound();
  }

  const lookup = await retrieveCheckoutSession(sessionId);
  if (!lookup.ok) {
    console.error("[upsell-bundle] failed to retrieve session", {
      session_id: sessionId,
      status: lookup.status,
      error: lookup.error,
    });
    notFound();
  }
  const session = lookup.session;
  const kitSlugRaw = session.metadata?.kit_slug ?? session.metadata?.source;
  const bumpSlugRaw = session.metadata?.bump_kit_slug ?? null;
  const leadId = session.client_reference_id;

  if (!kitSlugRaw || !isKitSlug(kitSlugRaw) || !leadId) {
    console.error("[upsell-bundle] session missing kit metadata", {
      session_id: sessionId,
      metadata: session.metadata,
    });
    notFound();
  }
  const primaryKit = getKitConfig(kitSlugRaw);
  const bumpKit =
    bumpSlugRaw && isKitSlug(bumpSlugRaw) ? getKitConfig(bumpSlugRaw) : null;
  if (!primaryKit) notFound();

  const paidUsd = dollarsFromCents(session.amount_total);
  // Authoritative "what they paid": Stripe `amount_total` is the source of truth.
  // The catalog math (KIT_RETAIL_USD + BUMP_USD) is a fallback if the session
  // omits a total for any reason (sandbox / promotion / off-Stripe edits).
  const expectedUsd = KIT_RETAIL_USD + (bumpKit ? BUMP_USD : 0);
  const effectivePaidUsd = paidUsd > 0 ? paidUsd : expectedUsd;
  const deltaUsd = Math.max(0, BUNDLE_PRICING.offerUsd - effectivePaidUsd);
  const remainingKits = (
    Object.values(KIT_CONFIG) as Array<{ slug: KitSlug; shortName: string }>
  ).filter((k) => k.slug !== primaryKit.slug && (!bumpKit || k.slug !== bumpKit.slug));

  const cancelled = searchParams?.cancelled === "1";

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
              [ paid · one-time offer ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                Wait — one more thing before you get your kit.
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 sm:text-xl">
              Your {primaryKit.shortName}
              {bumpKit ? <> + {bumpKit.shortName}</> : null} is on its way to
              your inbox. Before you go, an offer for the other{" "}
              {bumpKit ? "three" : "four"} kits — at a price that doesn&apos;t
              show up anywhere else on the site.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
            <Image
              src="/funnel-images/bundle-hero.png"
              alt="All 5 AI Pocket Agency kits — Dispatch Playbook on MacBook, Dev-Team Document Set on iPad, CLAUDE.md Template Library on iPhone, Discovery → MVP Prompt Pack and Wire-the-Brain-to-Stack as physical PDFs"
              width={1672}
              height={941}
              priority
              className="block w-full h-auto"
            />
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_0_60px_-25px_rgba(99,102,241,0.55)] sm:p-9">
            <h2 className="text-2xl font-bold leading-tight text-slate-50 sm:text-3xl">
              All 5 APA kits — the full stack, packaged once.
            </h2>
            <ul className="mt-6 space-y-2 text-base text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 text-accent">›</span>
                <span>
                  The Dispatch Playbook · the orchestrator manual
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-accent">›</span>
                <span>
                  The Dev-Team Document Set · eleven templates, three
                  conventions
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-accent">›</span>
                <span>
                  The CLAUDE.md Template Library · six pre-built starters
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-accent">›</span>
                <span>
                  Discovery → MVP Prompt Pack · the sequenced prompts +
                  Patrick case study
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-accent">›</span>
                <span>
                  Wire-the-Brain-to-Stack · seven MCP walkthroughs
                </span>
              </li>
            </ul>

            <div
              className="mt-8 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5"
              style={{ fontFamily: MONO_FONT }}
            >
              <div className="text-xs uppercase tracking-wider text-slate-400">
                pricing
              </div>
              <div className="mt-2 flex items-baseline gap-3 text-base">
                <span className="text-slate-500 line-through">
                  ${BUNDLE_PRICING.anchorUsd}
                </span>
                <span className="text-2xl font-extrabold text-accent">
                  ${BUNDLE_PRICING.offerUsd}
                </span>
                <span className="text-sm text-slate-400">today only</span>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-slate-300">
                You already paid ${effectivePaidUsd.toFixed(0)}, so today
                it&apos;s{" "}
                <span className="font-bold text-slate-100">
                  ${deltaUsd.toFixed(0)} more
                </span>{" "}
                for the remaining {remainingKits.length} kits. That&apos;s $
                {(BUNDLE_PRICING.anchorUsd - BUNDLE_PRICING.offerUsd).toFixed(0)}{" "}
                off retail, and less than the cost of{" "}
                {Math.floor(BUNDLE_PRICING.offerUsd / KIT_RETAIL_USD)} kits at
                $15 each.
              </div>
              <div className="mt-3 text-xs text-slate-500">
                This price isn&apos;t shown anywhere else on the site. Skip
                this page and you won&apos;t see it again.
              </div>
            </div>

            {cancelled ? (
              <div
                className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-center text-sm text-amber-200"
                role="status"
              >
                Bundle upgrade cancelled — no charge made. Your original kit is
                still being delivered.
              </div>
            ) : null}

            <div className="mt-8">
              <BundleUpgradeButton
                sessionId={sessionId}
                deltaUsd={deltaUsd}
                remainingCount={remainingKits.length}
              />
              <div className="mt-4 text-center">
                <Link
                  href={`/skool-invite/${encodeURIComponent(sessionId)}`}
                  className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                >
                  No thanks, just give me my kit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
