import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsIdeaEngine, tierAllowsIdeaEngineAutoBuild } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { getIdeaBySlug, listStageRuns, latestRunsByStage } from "@/lib/idea-engine/store";
import { toIdeaView } from "@/lib/idea-engine/types";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IdeaDetailClient } from "./IdeaDetailClient";

export const dynamic = "force-dynamic";

export default async function IdeaDetailPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const pa = await fetchPaUser(user.id);
  if (!pa.ok || !pa.data) redirect("/app/onboarding");

  // Tier OR active Project Pass (PA-POS-31); the pass grants the full chain incl. auto-build.
  const tier = await getCurrentTier(user.id);
  const access = await hasAppEntitlement(user.id, "idea_engine", { tier });
  const passEntitled = access.source === "project_pass";
  if (!tierAllowsIdeaEngine(tier) && !passEntitled) redirect("/app/apps/idea-engine");

  const ideaRes = await getIdeaBySlug(user.id, params.slug);
  if (!ideaRes.ok) notFound();
  if (!ideaRes.data) notFound();
  const idea = ideaRes.data;

  const runsRes = await listStageRuns(user.id, idea.id);
  const latest = runsRes.ok ? latestRunsByStage(runsRes.data) : new Map();
  const view = toIdeaView(idea, latest);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/app/apps/idea-engine" className="text-[11px] text-[#22d3ee]/60 font-mono hover:text-[#22d3ee]">
          ← Idea Engine
        </Link>
        <IdeaDetailClient
          idea={view}
          autoBuild={tierAllowsIdeaEngineAutoBuild(tier) || passEntitled}
          hasApiKey={Boolean(pa.data.anthropic_api_key)}
        />
      </div>
    </div>
  );
}
