// POST /api/app/apps/idea-engine/ideas/[id]/run-stage — run (or re-run) one stage of an idea.
//
// Body: { stage: 1..6, ideaSpace?, vertical? }. The route owns the stage-run lifecycle for stages 2
// and 3; the build (4/5) and launch (6) executors manage their own completion. Mode for the build
// stages is resolved from the tier (PA-IDEA-2/3): Studio+ → auto_build, else prompt_pack.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getCurrentTier,
  tierAllowsIdeaEngine,
  tierAllowsIdeaEngineAutoBuild,
} from "@/lib/personas/tier-caps";
import {
  runMarketValidation,
  runBlueprint,
  runBuildStage,
  runLaunch,
} from "@/lib/idea-engine/engine";
import {
  getIdeaById,
  createStageRun,
  updateStageRun,
  updateIdea,
  listStageRuns,
  latestRunsByStage,
} from "@/lib/idea-engine/store";
import type { MarketScan } from "@/lib/idea-engine/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  stage: z.number().int().min(1).max(6),
  ideaSpace: z.string().max(200).optional(),
  vertical: z.string().max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsIdeaEngine(tier)) {
    return NextResponse.json({ error: "The Idea Engine is a Pro+ feature." }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  const { stage } = parsed.data;

  const pa = await fetchPaUser(user.id);
  if (!pa.ok || !pa.data) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const ideaRes = await getIdeaById(user.id, params.id);
  if (!ideaRes.ok) return NextResponse.json({ error: ideaRes.error }, { status: ideaRes.status });
  if (!ideaRes.data) return NextResponse.json({ error: "Idea not found." }, { status: 404 });
  const idea = ideaRes.data;

  // Latest run per stage — used to read upstream outputs (market scan, blueprint).
  const runsRes = await listStageRuns(user.id, idea.id);
  const latest = runsRes.ok ? latestRunsByStage(runsRes.data) : new Map();

  // ── Stage 2 · Market validation ──────────────────────────────────────────────────────────────
  if (stage === 2) {
    const run = await createStageRun({ ideaId: idea.id, ownerId: user.id, stage: 2, status: "running" });
    const result = await runMarketValidation({
      ownerId: user.id,
      idea,
      ideaSpace: parsed.data.ideaSpace || idea.title,
      vertical: parsed.data.vertical || "small business owners",
      paUser: pa.data,
    });
    if (!result.ok) {
      if (run.ok) await updateStageRun(run.data.id, { status: "error", error: result.error, completed_at: new Date().toISOString() });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (run.ok) {
      await updateStageRun(run.data.id, {
        status: "complete",
        output: result.data as unknown as Record<string, unknown>,
        completed_at: new Date().toISOString(),
      });
    }
    if (idea.current_stage < 2) await updateIdea(user.id, idea.id, { current_stage: 2 });
    return NextResponse.json({ stage: 2, scan: result.data });
  }

  // ── Stage 3 · MVP blueprint ──────────────────────────────────────────────────────────────────
  if (stage === 3) {
    const scan = latest.get(2)?.output as MarketScan | undefined;
    if (!scan) return NextResponse.json({ error: "Run market validation (stage 2) first." }, { status: 409 });
    const run = await createStageRun({ ideaId: idea.id, ownerId: user.id, stage: 3, status: "running" });
    const result = await runBlueprint({ ownerId: user.id, idea, paUser: pa.data, marketIcp: scan.icp });
    if (!result.ok) {
      if (run.ok) await updateStageRun(run.data.id, { status: "error", error: result.error, completed_at: new Date().toISOString() });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // Stage 3 pauses for approval in Mission Control — keep the run `staged` with the plan markdown.
    if (run.ok) await updateStageRun(run.data.id, { status: "staged", output: { markdown: result.data.markdown } });
    if (idea.current_stage < 3) await updateIdea(user.id, idea.id, { current_stage: 3 });
    return NextResponse.json({ stage: 3, staged: true });
  }

  // ── Stage 4 / 5 · Build + Sales surface ──────────────────────────────────────────────────────
  if (stage === 4 || stage === 5) {
    if (idea.current_stage < stage) {
      return NextResponse.json(
        { error: stage === 4 ? "Approve the MVP plan (stage 3) first." : "Build the MVP (stage 4) first." },
        { status: 409 },
      );
    }
    const blueprintMd = (latest.get(3)?.output as { markdown?: string } | undefined)?.markdown ?? "";
    const mode = tierAllowsIdeaEngineAutoBuild(tier) ? "auto_build" : "prompt_pack";
    const run = await createStageRun({ ideaId: idea.id, ownerId: user.id, stage, status: "running" });
    if (!run.ok) return NextResponse.json({ error: run.error }, { status: run.status });
    const result = await runBuildStage({
      ownerId: user.id,
      idea,
      runId: run.data.id,
      mode,
      buildKind: stage === 4 ? "mvp" : "sales",
      paUser: pa.data,
      blueprintMd,
      githubLogin: null,
    });
    if (!result.ok) {
      await updateStageRun(run.data.id, { status: "error", error: result.error, completed_at: new Date().toISOString() });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ stage, ...result.data });
  }

  // ── Stage 6 · Launch ──────────────────────────────────────────────────────────────────────────
  if (stage === 6) {
    const scan = latest.get(2)?.output as MarketScan | undefined;
    if (!scan || scan.prospects.length === 0) {
      return NextResponse.json({ error: "Run market validation (stage 2) first — there are no prospects to reach." }, { status: 409 });
    }
    const run = await createStageRun({ ideaId: idea.id, ownerId: user.id, stage: 6, status: "running" });
    if (!run.ok) return NextResponse.json({ error: run.error }, { status: run.status });
    const result = await runLaunch({
      ownerId: user.id,
      idea,
      runId: run.data.id,
      prospects: scan.prospects,
      sourceName: `Idea Engine — ${idea.title}`,
      paUser: pa.data,
    });
    if (!result.ok) {
      await updateStageRun(run.data.id, { status: "error", error: result.error, completed_at: new Date().toISOString() });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ stage: 6, ...result.data });
  }

  // ── Stage 1 · Capture (re-run is a no-op that re-stamps complete) ─────────────────────────────
  const run = await createStageRun({ ideaId: idea.id, ownerId: user.id, stage: 1, status: "running" });
  if (run.ok) {
    await updateStageRun(run.data.id, {
      status: "complete",
      output: { captured: typeof idea.source_payload.detail === "string" ? idea.source_payload.detail : "" },
      completed_at: new Date().toISOString(),
    });
  }
  return NextResponse.json({ stage: 1, complete: true });
}
