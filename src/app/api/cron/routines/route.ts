import { NextResponse } from "next/server";
import {
  fetchDueRoutines,
  markRoutineRun,
  computeNextRun,
  ROUTINE_DEFS,
} from "@/lib/pa-routines";
import type { RoutineKind } from "@/lib/pa-routines";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  generateDailyBrief,
  generateFollowUpsDraft,
  generateWeeklyDigest,
} from "@/lib/pa-drafts";
import type { DigestPayload } from "@/lib/pa-drafts";
import { createPendingAction } from "@/lib/pa-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunResult = {
  id: string;
  kind: string;
  userId: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
};

function formatDigest(payload: DigestPayload): string {
  return [payload.learned, payload.pending, payload.suggestions]
    .map((s) => `### ${s.heading}\n${s.items.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueResult = await fetchDueRoutines();
  if (!dueResult.ok) {
    return NextResponse.json({ error: dueResult.error }, { status: 500 });
  }

  const results: RunResult[] = [];

  for (const routine of dueResult.data) {
    const now = new Date().toISOString();
    const nextRunAt = computeNextRun(routine.schedule_cron).toISOString();
    const kind = routine.kind as RoutineKind;
    const def = ROUTINE_DEFS[kind];

    // Fetch the user's PA profile
    const paResult = await fetchPaUser(routine.user_id);
    if (!paResult.ok || !paResult.data) {
      await markRoutineRun(routine.id, { lastRunAt: now, nextRunAt, lastError: "User profile not found" });
      results.push({ id: routine.id, kind, userId: routine.user_id, status: "skipped", reason: "user profile not found" });
      continue;
    }

    const { anthropic_api_key, brain_repo, github_token } = paResult.data;

    if (!anthropic_api_key) {
      await markRoutineRun(routine.id, { lastRunAt: now, nextRunAt, lastError: "No Anthropic API key configured" });
      results.push({ id: routine.id, kind, userId: routine.user_id, status: "skipped", reason: "no API key" });
      continue;
    }

    if (!brain_repo) {
      await markRoutineRun(routine.id, { lastRunAt: now, nextRunAt, lastError: "No brain connected" });
      results.push({ id: routine.id, kind, userId: routine.user_id, status: "skipped", reason: "no brain" });
      continue;
    }

    // Generate content
    let content: string;
    try {
      if (kind === "daily_brief") {
        const r = await generateDailyBrief(anthropic_api_key, brain_repo, github_token);
        content = r.brief;
      } else if (kind === "followup_sweep") {
        const r = await generateFollowUpsDraft({ context: "" }, anthropic_api_key, brain_repo, github_token);
        content = r.draft;
      } else {
        const payload = await generateWeeklyDigest(anthropic_api_key, brain_repo, github_token);
        content = formatDigest(payload);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Generation failed";
      await markRoutineRun(routine.id, { lastRunAt: now, nextRunAt, lastError: errMsg });
      results.push({ id: routine.id, kind, userId: routine.user_id, status: "error", reason: errMsg });
      continue;
    }

    // Write result to the approval inbox
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const actionResult = await createPendingAction({
      userId: routine.user_id,
      actionType: "routine_output",
      title: `${def.label} — ${today}`,
      summary: `Your ${def.label.toLowerCase()} is ready. Read it, then dismiss.`,
      payload: { kind, content },
    });

    const runError = actionResult.ok
      ? null
      : `Pending action write failed: ${actionResult.error}`;

    await markRoutineRun(routine.id, { lastRunAt: now, nextRunAt, lastError: runError });
    results.push({
      id: routine.id,
      kind,
      userId: routine.user_id,
      status: actionResult.ok ? "ok" : "error",
      reason: runError ?? undefined,
    });
  }

  return NextResponse.json({ processed: dueResult.data.length, results });
}
