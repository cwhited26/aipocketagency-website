// /api/app/apps/browser/jobs — the Browser Agent job list (GET, 3s poll from the surface) and
// job creation (POST). Studio+ / Enterprise only (PA-POS-19); the Gate Phase treatment runs at
// creation and a Customer Name hit refuses the job with a rewrite suggestion.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  browserAgentJobLimits,
  getCurrentTier,
  tierAllowsBrowserAgent,
} from "@/lib/personas/tier-caps";
import { insertBrowserJob, listBrowserJobs } from "@/lib/browser-agent/db";
import { runBrowserJobGates } from "@/lib/browser-agent/gates";
import { CreateJobBodySchema } from "@/lib/browser-agent/types";
import { toJobListView } from "@/lib/browser-agent/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await listBrowserJobs(user.id);
  if (!res.ok) return NextResponse.json({ error: "Could not load jobs" }, { status: 500 });
  return NextResponse.json({ jobs: res.data.map(toJobListView) });
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsBrowserAgent(tier)) {
    return NextResponse.json(
      { error: "The Browser Agent is part of the AI Agent Workspace plan and up." },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateJobBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const body = parsed.data;

  // Tier ceilings clamp server-side too — the sliders are UI sugar, not the gate.
  const limits = browserAgentJobLimits(tier);
  const maxSteps = Math.min(body.maxSteps, limits.maxSteps);
  const maxWallSeconds = Math.min(body.maxWallSeconds, limits.maxWallSeconds);
  const maxCostMicroCents = Math.min(body.maxCostCents, limits.maxCostCents) * 10_000;

  // Gate Phase treatment before anything is queued.
  const gates = await runBrowserJobGates({
    ownerId: user.id,
    intent: body.intent,
    startingUrl: body.startingUrl,
  });
  if (!gates.ok) {
    return NextResponse.json(
      { error: gates.reason, suggestion: gates.suggestion, refusedByGate: true },
      { status: 422 },
    );
  }

  const inserted = await insertBrowserJob({
    ownerId: user.id,
    agentPersonaId: body.agentPersonaId,
    intent: body.intent.trim(),
    startingUrl: body.startingUrl.trim(),
    maxSteps,
    maxWallSeconds,
    maxCostMicroCents,
    gateFindings: gates.findings.length > 0 ? gates.findings : null,
  });
  if (!inserted.ok) {
    console.error("[browser-agent/jobs] insert failed", { error: inserted.error });
    return NextResponse.json({ error: "Could not create the job" }, { status: 500 });
  }
  return NextResponse.json({ job: toJobListView(inserted.data) }, { status: 201 });
}
