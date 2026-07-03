// /app/apps/agent-builder — the Custom Agent Builder App (PA-POS-27, Positioning Lock §19).
// Studio+ / Enterprise; lower tiers see the surface with an upgrade chip. The homepage hero's
// "Compose →" hands its spec here via ?spec=<encoded> for entitled owners.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsAgentBuilder } from "@/lib/personas/tier-caps";
import { listAgentBuilds } from "@/lib/agent-builder/db";
import AgentBuilderClient from "./AgentBuilderClient";

export default async function AgentBuilderPage({
  searchParams,
}: {
  searchParams: { spec?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const tier = await getCurrentTier(user.id);
  const unlocked = tierAllowsAgentBuilder(tier);

  const buildsResult = unlocked
    ? await listAgentBuilds(user.id)
    : ({ ok: true, data: [] } as const);
  const builds = buildsResult.ok ? buildsResult.data : [];

  const prefill = typeof searchParams.spec === "string" ? searchParams.spec.slice(0, 4_000) : "";

  return (
    <AgentBuilderClient
      unlocked={unlocked}
      prefillSpec={prefill}
      initialBuilds={builds.map((b) => ({
        id: b.id,
        specText: b.spec_text,
        status: b.status,
        personaSlug: b.composed_persona_slug,
        createdAt: b.created_at,
      }))}
    />
  );
}
