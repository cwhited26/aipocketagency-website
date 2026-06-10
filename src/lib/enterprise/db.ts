// Enterprise application persistence — service-role insert into pa_enterprise_applications.
//
// The /enterprise/apply form is public + unauthenticated, so writes go through the service-role key
// (same env resolution as the rest of the PA service-role layer). RLS on the table is deny-all; the
// service-role key bypasses it. Operator reads (Chase / team) use the same key behind isOperatorEmail.

import type { EnterpriseApplicationInput, QualificationRoute } from "./types";

type InsertResult = { ok: true } | { ok: false; status: number; error: string };

function serviceEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

/** Insert one Enterprise application with its server-computed score + route. */
export async function insertEnterpriseApplication(
  app: EnterpriseApplicationInput,
  qualificationScore: number,
  qualificationRoute: QualificationRoute,
): Promise<InsertResult> {
  const env = serviceEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const row = {
    email: app.email,
    first_name: app.firstName || null,
    last_name: app.lastName || null,
    phone: app.phone || null,
    company: app.company,
    website: app.website || null,
    role: app.role,
    business_type: app.businessType || null,
    what_you_sell: app.whatYouSell,
    who_you_sell_to: app.whoYouSellTo || null,
    monthly_revenue_range: app.monthlyRevenueRange || null,
    team_size: app.teamSize || null,
    current_ai_tools: app.currentAiTools,
    current_ai_pain: app.currentAiPain,
    context_locations: app.contextLocations,
    desired_workflows: app.desiredWorkflows,
    biggest_bottleneck: app.biggestBottleneck,
    success_outcome: app.successOutcome || null,
    interested_apps: app.interestedApps,
    high_volume_usage: app.highVolumeUsage || null,
    needs_permissions: app.needsPermissions || null,
    needs_byo_llm: app.needsByoLlm || null,
    needs_integrations: app.needsIntegrations || null,
    integration_systems: app.integrationSystems || null,
    timeline: app.timeline || null,
    implementation_owner: app.implementationOwner || null,
    willing_to_gather_context: app.willingToGatherContext || null,
    used_pocket_agent_before: app.usedPocketAgentBefore || null,
    budget_range: app.budgetRange || null,
    dwy_interest: app.dwyInterest || null,
    additional_notes: app.additionalNotes || null,
    qualification_score: qualificationScore,
    qualification_route: qualificationRoute,
  };

  const res = await fetch(`${env.url}/rest/v1/pa_enterprise_applications`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}
