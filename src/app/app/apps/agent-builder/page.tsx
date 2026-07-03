// /app/apps/agent-builder — the Custom Agent Builder App (PA-POS-27, Positioning Lock §19).
// Studio+ / Enterprise — or an active Project Pass (PA-POS-31); lower tiers see the surface
// with an upgrade chip AND the pass rental next to it. The homepage hero's "Compose →" hands
// its spec here via ?spec=<encoded> for entitled owners.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { getPassDef, passPriceCents } from "@/data/project-passes";
import { MeteringPanel } from "@/components/metering/MeteringPanel";
import { PassOfferCard } from "@/components/metering/PassOfferCard";
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

  // Tier OR active Project Pass (PA-POS-31) — the widened gate.
  const tier = await getCurrentTier(user.id);
  const access = await hasAppEntitlement(user.id, "agent_builder", { tier });
  const unlocked = access.allowed;

  const buildsResult = unlocked
    ? await listAgentBuilds(user.id)
    : ({ ok: true, data: [] } as const);
  const builds = buildsResult.ok ? buildsResult.data : [];

  const prefill = typeof searchParams.spec === "string" ? searchParams.spec.slice(0, 4_000) : "";

  const passDef = getPassDef("agent_builder");

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-4 space-y-3">
        {/* Credits chip (Studio+/Enterprise only — renders null below), pass chip, nudge. */}
        <MeteringPanel ownerId={user.id} appSlug="agent_builder" access={access} />
        {!unlocked && passDef ? (
          <PassOfferCard
            offer={{
              appSlug: "agent_builder",
              label: passDef.label,
              priceCents: passPriceCents(passDef, tier),
              windowLabel: passDef.windowLabel,
            }}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
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
      </div>
    </div>
  );
}
