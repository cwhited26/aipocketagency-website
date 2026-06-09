import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listSources } from "@/lib/followup-sweeps/db";
import { redirect } from "next/navigation";
import FollowUpSweepsClient, { type SourceView } from "./FollowUpSweepsClient";

export default async function FollowUpSweepsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const sourcesResult = await listSources(user.id);
  const sources: SourceView[] = sourcesResult.ok
    ? sourcesResult.data.map((s) => ({
        id: s.id,
        sourceType: s.source_type,
        label: s.source_config.label,
        relationship: s.source_config.relationship,
        dormancyDays: s.dormancy_days,
        enabled: s.enabled,
        lastSweptAt: s.last_swept_at,
      }))
    : [];

  return (
    <FollowUpSweepsClient
      sources={sources}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
      hasBrain={Boolean(paUser.brain_repo)}
    />
  );
}
