import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchLeadScoutConnectionPublic } from "@/lib/pa-lead-scout-connections";
import { LEAD_SCOUT_PACKS } from "@/lib/leads/packs";
import { getCurrentTier, tierAllowsLeadScoutPacks, TIER_LABELS } from "@/lib/personas/tier-caps";
import { redirect } from "next/navigation";
import Link from "next/link";
import PacksClient, { type PackView } from "./PacksClient";
import { LEAD_SCOUT } from "@/lib/copy/in-app";

export const dynamic = "force-dynamic";

// Map the on-disk packs to the display-only view the client renders. The outreach_voice_brief stays
// server-side — it's a generation hint for the Email Drafter, not something the browser needs.
const PACK_VIEWS: PackView[] = LEAD_SCOUT_PACKS.map((p) => ({
  name: p.name,
  verticalSlug: p.vertical_slug,
  icon: p.icon,
  tagline: p.tagline,
  description: p.display_description,
  category: p.default_google_maps_category,
  radiusMiles: p.default_radius_miles,
  minReviews: p.default_filters.min_reviews,
  recommendedTier: p.recommended_tier === "studio_plus" ? "Studio+" : "Studio",
}));

export default async function LeadScoutPacksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const [connResult, tier] = await Promise.all([
    fetchLeadScoutConnectionPublic(user.id),
    getCurrentTier(user.id),
  ]);
  const connected = connResult.ok && connResult.data?.status === "active";
  const canSubscribe = tierAllowsLeadScoutPacks(tier);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps/lead-scout"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Lead Scout
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            One tap, the whole loop
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Lead Scout Packs</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Pick your trade and a place. PA runs the sweep with the right category, the right filters,
            and a no-website cut already dialed in for that vertical — then drafts the first email in
            your voice, tuned to how you&apos;d pitch a roofer versus a law firm. No setup, no guessing
            at search terms. Tap a pack and you land in its workspace with the first batch already
            running.
          </p>
        </div>

        {!canSubscribe && (
          <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-slate-100">
              {LEAD_SCOUT.upgradeGate.headline}
            </p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              {LEAD_SCOUT.upgradeGate.body}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/pricing"
                className="rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-[#06b6d4] transition-colors"
              >
                {LEAD_SCOUT.upgradeGate.cta}
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-slate-600 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-slate-400 hover:text-slate-100 transition-colors"
              >
                {LEAD_SCOUT.upgradeGate.secondaryCta}
              </Link>
            </div>
          </div>
        )}

        {canSubscribe && !connected && (
          <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-slate-100">Connect Bright Data to run a pack</p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              Subscribing still creates the source — but the first sweep needs Bright Data connected in{" "}
              <Link href="/app/settings/connections" className="text-[#22d3ee] hover:underline">
                Settings → Connections
              </Link>
              . Connect it and the sweep runs the moment you subscribe.
            </p>
          </div>
        )}

        <PacksClient packs={PACK_VIEWS} canSubscribe={canSubscribe} />
      </div>
    </div>
  );
}
