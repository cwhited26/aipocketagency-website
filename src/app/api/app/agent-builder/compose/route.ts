// POST /api/app/agent-builder/compose — the Custom Agent Builder's one entry point (PA-POS-27).
// Owner's plain-English spec in; ONE agent_builder_proposal card in Mission Control out.
//
// Sequence: tier gate (Studio+/Enterprise) → build row (draft) → parse (one model call, cost
// ledgered) → deterministic compose (persona / toolkit / skills / brain scopes) → Gate Phase
// against the composed spec → stage the approval card. A gate refusal or parse failure flips
// the build row to failed and returns the reason — nothing is staged, nothing persists beyond
// the record of the attempt.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsAgentBuilder } from "@/lib/personas/tier-caps";
import { listPersonasForBusiness } from "@/lib/personas/db";
import { createAgentBuild, updateAgentBuild } from "@/lib/agent-builder/db";
import { AgentSpecParseError, parseAgentSpec } from "@/lib/agent-builder/parse";
import { composePersona } from "@/lib/agent-builder/compose-persona";
import { composeToolkit } from "@/lib/agent-builder/compose-toolkit";
import { composeSkills } from "@/lib/agent-builder/compose-skills";
import { composeBrainScopes } from "@/lib/agent-builder/compose-brain-scopes";
import { runAgentBuildGates } from "@/lib/agent-builder/gates";
import { stageAgentBuildApproval } from "@/lib/agent-builder/stage-approval";
import { type ComposedAgent } from "@/lib/agent-builder/types";
import { agentBuilderLog } from "@/lib/agent-builder/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  spec: z.string().min(12, "Describe the agent in at least a sentence.").max(4_000),
  workspaceId: z.string().uuid().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsedBody = BodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.message }, { status: 422 });
  }

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsAgentBuilder(tier)) {
    return NextResponse.json(
      {
        error:
          "The Custom Agent Builder is part of the AI Agent Workspace tier. Upgrade to compose agents from a description.",
      },
      { status: 403 },
    );
  }

  const paRes = await fetchPaUser(user.id);
  const pa = paRes.ok ? paRes.data : null;
  const paManagedKey = pa?.anthropic_api_key ?? "";

  const build = await createAgentBuild({
    ownerId: user.id,
    workspaceId: parsedBody.data.workspaceId ?? null,
    specText: parsedBody.data.spec,
  });
  if (!build.ok) {
    return NextResponse.json({ error: build.error }, { status: build.status });
  }
  const buildId = build.data.id;

  const failBuild = async () => {
    await updateAgentBuild({ id: buildId, ownerId: user.id, patch: { status: "failed" } });
  };

  // 1. Parse — the one model call.
  let intent;
  try {
    intent = await parseAgentSpec({
      ownerId: user.id,
      buildId,
      specText: parsedBody.data.spec,
      paManagedKey,
    });
  } catch (e) {
    await failBuild();
    if (e instanceof AgentSpecParseError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  // 2. Compose — deterministic, over shipped primitives only.
  const personas = await listPersonasForBusiness(user.id).catch(() => []);
  const persona = composePersona({
    intent,
    existingNames: personas.map((p) => p.name),
  });
  const apps = composeToolkit(intent);
  const { skillSlugs, candidateSkill } = composeSkills(intent);
  const brainScopes = composeBrainScopes(intent);

  const composed: ComposedAgent = {
    buildId,
    specText: parsedBody.data.spec,
    intent,
    personaTemplateKey: persona.templateKey,
    personaName: persona.name,
    personaSlug: persona.slug,
    tone: persona.tone,
    starterPrompt: persona.starterPrompt,
    customFields: persona.customFields,
    apps,
    skillSlugs,
    brainScopes,
    schedule: intent.schedule,
    candidateSkill,
  };

  // 3. Gate Phase — BEFORE the approval card renders (§19).
  const gates = await runAgentBuildGates({ ownerId: user.id, composed });
  if (!gates.ok) {
    await failBuild();
    return NextResponse.json(
      { error: gates.reason, suggestion: gates.suggestion },
      { status: 422 },
    );
  }

  // 4. Stage the ONE approval card.
  const staged = await stageAgentBuildApproval({ ownerId: user.id, composed });
  if (!staged.ok) {
    await failBuild();
    return NextResponse.json({ error: staged.error }, { status: staged.status });
  }

  agentBuilderLog.info("composed agent staged for approval", {
    ownerId: user.id,
    buildId,
    persona: composed.personaSlug,
    apps: composed.apps.join(","),
    skills: composed.skillSlugs.join(","),
    candidateSkill: composed.candidateSkill?.slug ?? null,
  });

  return NextResponse.json(
    {
      buildId,
      inboxItemId: staged.inboxItemId,
      personaName: composed.personaName,
      apps: composed.apps,
      skillSlugs: composed.skillSlugs,
      brainScopes: composed.brainScopes,
      schedule: composed.schedule,
      candidateSkill: composed.candidateSkill
        ? { slug: composed.candidateSkill.slug, name: composed.candidateSkill.name }
        : null,
    },
    { status: 201 },
  );
}
