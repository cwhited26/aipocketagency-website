import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsIdeaEngine, tierAllowsIdeaEngineAutoBuild } from "@/lib/personas/tier-caps";
import { listIdeas } from "@/lib/idea-engine/store";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IdeaEngineClient, type IdeaListItem } from "./IdeaEngineClient";
import { IDEA_ENGINE } from "@/lib/copy/in-app";
import { AppEmptyState } from "@/app/app/_components/AppEmptyState";

export const dynamic = "force-dynamic";

export default async function IdeaEnginePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const pa = await fetchPaUser(user.id);
  if (!pa.ok || !pa.data) redirect("/app/onboarding");

  const tier = await getCurrentTier(user.id);
  // Pro+ and above only. Below that the card isn't even on the Apps grid, but guard the URL too.
  if (!tierAllowsIdeaEngine(tier)) {
    return (
      <div className="h-full overflow-y-auto bg-[#06080b]">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <Link href="/app/apps" className="text-[11px] text-[#22d3ee]/60 font-mono hover:text-[#22d3ee]">
            ← Apps
          </Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-4">Idea Engine</h1>
          <div className="mt-6">
            <AppEmptyState
              copy={IDEA_ENGINE.upgradeGate}
              ctaHref="/app/settings/tier"
            />
          </div>
        </div>
      </div>
    );
  }

  const autoBuild = tierAllowsIdeaEngineAutoBuild(tier);
  const ideasRes = await listIdeas(user.id);
  const ideas: IdeaListItem[] = ideasRes.ok
    ? ideasRes.data.map((i) => ({
        slug: i.slug,
        title: i.title,
        source: i.source,
        status: i.status,
        currentStage: i.current_stage,
        updatedAt: i.updated_at,
      }))
    : [];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/app/apps" className="text-[11px] text-[#22d3ee]/60 font-mono hover:text-[#22d3ee]">
          ← Apps
        </Link>
        <div className="mt-4 mb-7">
          <h1 className="text-2xl font-bold text-slate-100">Idea Engine</h1>
          <p className="text-slate-200 text-sm mt-3 leading-relaxed">
            {IDEA_ENGINE.empty.headline}
          </p>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            {IDEA_ENGINE.empty.subheadline}
          </p>
          {!autoBuild && (
            <div className="mt-4 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/[0.04] px-4 py-4">
              <p className="text-sm font-semibold text-slate-100">{IDEA_ENGINE.proPlusGate.headline}</p>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{IDEA_ENGINE.proPlusGate.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/pricing"
                  className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-[#67e8f9] transition-colors"
                >
                  {IDEA_ENGINE.proPlusGate.cta}
                </Link>
                <span className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400">
                  {IDEA_ENGINE.proPlusGate.secondaryCta}
                </span>
              </div>
            </div>
          )}
        </div>

        <IdeaEngineClient ideas={ideas} hasApiKey={Boolean(pa.data.anthropic_api_key)} />
      </div>
    </div>
  );
}
