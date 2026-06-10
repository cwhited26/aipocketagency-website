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

  const [completedResult, personaCount, installsResult] = await Promise.all([
    listCompletedSteps(user.id),
    countPersonasForBusiness(user.id),
    listVaultInstalls(user.id),
  ]);
  const completed = completedResult.ok ? completedResult.data : [];
  const installs = installsResult.ok ? installsResult.data : [];

  const starterSlugs = new Set(starterSeedRecipes().map((r) => r.slug));
  const seededWorkflowCount = installs.filter((i) => starterSlugs.has(i.recipe_slug)).length;

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
