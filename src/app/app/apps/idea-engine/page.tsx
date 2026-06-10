import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsIdeaEngine, tierAllowsIdeaEngineAutoBuild } from "@/lib/personas/tier-caps";
import { listIdeas } from "@/lib/idea-engine/store";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IdeaEngineClient, type IdeaListItem } from "./IdeaEngineClient";

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
          <p className="text-slate-300 text-sm mt-3 leading-relaxed">
            The Idea Engine turns an idea into a shipped MVP on your own accounts. It&apos;s a Pro+ feature.{" "}
            <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
              See your plan →
            </Link>
          </p>
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
            You have brilliant ideas. They keep dying in a notes app.
          </p>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            A chain of agents that turns an idea into a shipped MVP. Not one more prompt box. Drop an
            idea, approve the plan, and {autoBuild ? "PA ships the MVP on your accounts" : "PA hands you the prompts to build it"} —
            ending with {autoBuild ? "a working " : "a plan and the prompts for a "}
            <span className="font-mono text-[#22d3ee]/80">&lt;slug&gt;.vercel.app</span>
            {autoBuild ? " URL." : " page."}
          </p>
          {!autoBuild && (
            <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
              You&apos;re on prompt-pack mode (Pro+): PA runs the market scan and the plan, then writes
              the prompts you paste into Cursor or Claude Code. Studio+ ships the MVP for you, step by
              step.
            </p>
          )}
        </div>

        <IdeaEngineClient ideas={ideas} hasApiKey={Boolean(pa.data.anthropic_api_key)} />
      </div>
    </div>
  );
}
