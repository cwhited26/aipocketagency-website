import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import {
  LAUNCH_KIT_SECTIONS,
  LAUNCH_KIT_STEP_COUNT,
  IMPLEMENTATION_GUARANTEE,
} from "@/lib/launch-kit/steps";
import { listCompletedSteps } from "@/lib/launch-kit/progress";
import { loadLaunchKitDoc } from "@/lib/launch-kit/content";
import { ensureLaunchKitSeeded } from "@/lib/launch-kit/seed";
import { listVaultInstalls } from "@/lib/workflow-vault/installs";
import { starterSeedRecipes } from "@/lib/workflow-vault/recipes";
import { countPersonasForBusiness } from "@/lib/personas/db";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { fetchGithubBuildConnectionPublic } from "@/lib/pa-github-build-connections";
import { fetchVercelConnectionPublic } from "@/lib/pa-vercel-connections";
import { fetchSupabaseConnectionPublic } from "@/lib/pa-supabase-connections";
import { isGithubBuildOAuthConfigured } from "@/lib/connectors/github-build/oauth";
import { launchKitConnectItems } from "@/lib/build-tools/onboarding";
import { LaunchKitBuildSection } from "@/components/build-tools/LaunchKitBuildSection";
import Markdown from "@/components/Markdown";
import LaunchKitClient from "./LaunchKitClient";

export const dynamic = "force-dynamic";

export default async function LaunchKitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const seeded = await ensureLaunchKitSeeded(user.id);
  if (!seeded.ok) {
    // Seeding is best-effort — the owner can still work the checklist. Surface the failure in logs.
    console.error("Launch Kit seed failed:", seeded.error);
  }

  const [
    completedResult,
    personaCount,
    installsResult,
    tier,
    githubBuildResult,
    vercelResult,
    supabaseResult,
  ] = await Promise.all([
    listCompletedSteps(user.id),
    countPersonasForBusiness(user.id),
    listVaultInstalls(user.id),
    getCurrentTier(user.id),
    fetchGithubBuildConnectionPublic(user.id),
    fetchVercelConnectionPublic(user.id),
    fetchSupabaseConnectionPublic(user.id),
  ]);
  const completed = completedResult.ok ? completedResult.data : [];
  const installs = installsResult.ok ? installsResult.data : [];

  const starterSlugs = new Set(starterSeedRecipes().map((r) => r.slug));
  const seededWorkflowCount = installs.filter((i) => starterSlugs.has(i.recipe_slug)).length;

  // Tier-aware Build Tools items — only shown to tiers that build on the platform (PA-BUILDONBOARD-1).
  // Connected state is auto-detected from the connection rows; no manual checkbox.
  const buildItems = launchKitConnectItems({
    tier,
    connected: {
      github_build: (githubBuildResult.ok ? githubBuildResult.data?.status : null) === "active",
      vercel: (vercelResult.ok ? vercelResult.data?.status : null) === "active",
      supabase: (supabaseResult.ok ? supabaseResult.data?.status : null) === "active",
    },
    githubOAuthConfigured: isGithubBuildOAuthConfigured(),
  });

  const missionControlMd = loadLaunchKitDoc("mission-control-review");
  const sevenDayMd = loadLaunchKitDoc("7-day-setup-plan");

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        <LaunchKitClient
          sections={LAUNCH_KIT_SECTIONS}
          completed={completed}
          stepCount={LAUNCH_KIT_STEP_COUNT}
          personaCount={personaCount}
          seededWorkflowCount={seededWorkflowCount}
          starterSeedCount={starterSlugs.size}
          guarantee={IMPLEMENTATION_GUARANTEE}
        />

        {buildItems.length > 0 && (
          <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
            <LaunchKitBuildSection items={buildItems} />
          </section>
        )}

        <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
          <Markdown source={missionControlMd} />
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
          <Markdown source={sevenDayMd} />
        </section>
      </div>
    </div>
  );
}
