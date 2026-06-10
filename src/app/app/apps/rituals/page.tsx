import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { countActiveRituals, listRituals } from "@/lib/rituals/db";
import { RITUAL_SEEDS } from "@/lib/rituals/seed";
import { getCurrentTier, ritualActiveCap } from "@/lib/personas/tier-caps";
import { APP_CATALOG } from "@/lib/apps/catalog";
import { redirect } from "next/navigation";
import RitualsClient, { type RitualView } from "./RitualsClient";

export default async function RitualsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const [ritualsResult, activeResult] = await Promise.all([
    listRituals(user.id),
    countActiveRituals(user.id),
  ]);

  const rituals: RitualView[] = ritualsResult.ok
    ? ritualsResult.data.map((r) => ({
        id: r.id,
        name: r.name,
        appSlug: r.app_slug,
        scheduleText: r.schedule_natural_text,
        delivery: r.delivery,
        enabled: r.enabled,
        nextRunAt: r.next_run_at,
        lastRunAt: r.last_run_at,
        lastRunStatus: r.last_run_status,
        consecutiveFailures: r.consecutive_failures,
      }))
    : [];

  const tier = await getCurrentTier(user.id);
  const activeCount = activeResult.ok ? activeResult.data : rituals.filter((r) => r.enabled).length;

  // The App picker offers every catalog App except the scheduler itself (a ritual shouldn't run rituals).
  const apps = APP_CATALOG.filter((a) => a.id !== "ritual-scheduler").map((a) => ({
    id: a.id,
    label: a.label,
    blurb: a.blurb,
  }));

  return (
    <RitualsClient
      rituals={rituals}
      seeds={RITUAL_SEEDS.map((s) => ({
        id: s.id,
        name: s.name,
        scheduleText: s.scheduleText,
        description: s.description,
      }))}
      apps={apps}
      cap={ritualActiveCap(tier)}
      activeCount={activeCount}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
    />
  );
}
