import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { PODCAST_PACKS } from "@/lib/podcasts/packs";
import { getCurrentTier, tierAllowsPodcastPacks, TIER_LABELS } from "@/lib/personas/tier-caps";
import { redirect } from "next/navigation";
import Link from "next/link";
import PacksClient, { type PackView } from "./PacksClient";

export const dynamic = "force-dynamic";

// Map the on-disk packs to the display view the client renders.
const PACK_VIEWS: PackView[] = PODCAST_PACKS.map((p) => ({
  name: p.name,
  verticalSlug: p.vertical_slug,
  icon: p.icon,
  tagline: p.tagline,
  description: p.display_description,
  defaultCadence: p.default_cadence,
  shows: p.shows.map((s) => ({ title: s.title, host: s.host })),
  recommendedTier: p.recommended_tier === "studio_plus" ? "Studio+" : "Studio",
}));

export default async function PodcastPacksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const tier = await getCurrentTier(user.id);
  const canSubscribe = tierAllowsPodcastPacks(tier);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps/podcasts"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Podcast Ingester
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            One tap, a whole vertical&apos;s signal
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Podcast Packs</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Pick your world and PA follows the shows that move it — the ones the best operators in your
            trade actually listen to. Every new episode gets transcribed and filed in your brain, so the
            pricing play or close that drops on a Tuesday is in your hands Tuesday, not whenever you next
            had a free 90 minutes. One tap subscribes to the whole bundle.
          </p>
        </div>

        {!canSubscribe && (
          <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-slate-100">
              Packs are a Studio+ feature — you&apos;re on {TIER_LABELS[tier]}
            </p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              Browse them all below. To follow a whole vertical in one tap,{" "}
              <Link href="/pricing" className="text-[#22d3ee] hover:underline">
                upgrade to Studio+
              </Link>
              . You can still follow any single show by hand on the{" "}
              <Link href="/app/apps/podcasts" className="text-[#22d3ee] hover:underline">
                Podcast Ingester page
              </Link>{" "}
              on any plan.
            </p>
          </div>
        )}

        <PacksClient packs={PACK_VIEWS} canSubscribe={canSubscribe} />
      </div>
    </div>
  );
}
