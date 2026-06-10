import { createClient } from "@/lib/supabase/server";
import { getRitual, listRitualRuns } from "@/lib/rituals/db";
import { resolveRitualTarget } from "@/lib/rituals/seed";
import { redirect, notFound } from "next/navigation";
import RitualDetailClient, { type RitualRunRow } from "./RitualDetailClient";

export default async function RitualDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ritualResult = await getRitual(params.id, user.id);
  if (!ritualResult.ok || !ritualResult.data) notFound();
  const ritual = ritualResult.data;

  const runsResult = await listRitualRuns(params.id);
  const runs: RitualRunRow[] = runsResult.ok
    ? runsResult.data.map((r) => ({
        id: r.id,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        status: r.status,
        errorText: r.error_text,
        costMicroCents: r.cost_micro_cents,
      }))
    : [];

  const target = ritual.app_slug ? resolveRitualTarget(ritual.app_slug) : null;
  const totalMicroCents = runs.reduce((sum, r) => sum + (r.costMicroCents || 0), 0);

  return (
    <RitualDetailClient
      ritual={{
        id: ritual.id,
        name: ritual.name,
        appLabel: target?.label ?? ritual.app_slug ?? "a saved Plan",
        scheduleText: ritual.schedule_natural_text,
        delivery: ritual.delivery,
        enabled: ritual.enabled,
        nextRunAt: ritual.next_run_at,
        lastRunStatus: ritual.last_run_status,
        consecutiveFailures: ritual.consecutive_failures,
      }}
      runs={runs}
      totalMicroCents={totalMicroCents}
    />
  );
}
