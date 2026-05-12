import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchLeadFunnelById } from "@/lib/wc-admin-supabase";
import {
  BUNDLE_PRICING,
  BUMP_USD,
  KIT_RETAIL_USD,
  KIT_CONFIG,
  getKitConfig,
  isKitSlug,
  type KitSlug,
} from "@/lib/kit-config";
import FunnelCheckoutButtons from "./FunnelCheckoutButtons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateMetadata(): Metadata {
  return {
    title: "Last call — APA kit bundle | AI Pocket Agency",
    description:
      "All five APA kits, packaged once. $47 — anchor $97. This price isn't shown anywhere else on the site.",
    robots: { index: false, follow: false },
  };
}

export default async function UpgradeBundlePage({
  params,
  searchParams,
}: {
  params: { "kit-slug": string; lead_id: string };
  searchParams: { pair?: string };
}) {
  const slug = params["kit-slug"];
  const leadId = params.lead_id;

  if (!isKitSlug(slug)) notFound();
  if (!UUID_V4_RE.test(leadId)) notFound();

  const lookup = await fetchLeadFunnelById(leadId);
  if (!lookup.ok) {
    console.error("[upgrade-bundle] failed to load lead", {
      lead_id: leadId,
      status: lookup.status,
      error: lookup.error,
    });
    notFound();
  }
  if (!lookup.lead) notFound();
  if (lookup.lead.source !== slug) {
    console.error("[upgrade-bundle] slug/source mismatch", {
      lead_id: leadId,
      url_slug: slug,
      lead_source: lookup.lead.source,
    });
    notFound();
  }

  const primaryKit = getKitConfig(slug);
  if (!primaryKit) notFound();
  const pairAccepted = searchParams?.pair === "1";
  const bumpKit = pairAccepted ? getKitConfig(primaryKit.bumpTarget) : null;

  const alreadyCommittedUsd =
    KIT_RETAIL_USD + (pairAccepted ? BUMP_USD : 0);
  const deltaUsd = Math.max(
    0,
    BUNDLE_PRICING.offerUsd - alreadyCommittedUsd,
  );
  const remainingKits = (
    Object.values(KIT_CONFIG) as Array<{ slug: KitSlug; shortName: string }>
  ).filter((k) => k.slug !== primaryKit.slug && (!bumpKit || k.slug !== bumpKit.slug));

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
              [ step 2 of 2 · last call ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                One last thing — the full stack at a price you won&apos;t see again.
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 sm:text-xl">
              Your {primaryKit.shortName}
              {bumpKit ? <> + {bumpKit.shortName}</> : null} is queued. Before
              payment, an offer for the other {remainingKits.length} kits — at
              a price that doesn&apos;t show up anywhere else on the site.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
            <Image
              src="/funnel-images/bundle-hero.png"
              alt="All 5 AI Pocket Agency kits — Dispatch Playbook, Dev-Team Document Set, CLAUDE.md Template Library, Discovery → MVP Prompt Pack, Wire-the-Brain-to-Stack"
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
                You&apos;d pay ${alreadyCommittedUsd} for what&apos;s already
                queued. Add the rest now and the full stack is{" "}
                <span className="font-bold text-slate-100">
                  ${BUNDLE_PRICING.offerUsd}
                </span>
                {deltaUsd > 0 ? (
                  <>
                    {" "}
                    — that&apos;s ${deltaUsd} more for the remaining{" "}
                    {remainingKits.length} kits.
                  </>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                This price isn&apos;t shown anywhere else on the site. Skip
                this page and you won&apos;t see it again.
              </div>
            </div>

            <div className="mt-8">
              <FunnelCheckoutButtons
                leadId={leadId}
                pair={pairAccepted}
                bundleDeltaUsd={deltaUsd}
                pairAddOnUsd={pairAccepted ? BUMP_USD : 0}
                primaryUsd={KIT_RETAIL_USD}
                primaryShortName={primaryKit.shortName}
                bumpShortName={bumpKit?.shortName ?? null}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
