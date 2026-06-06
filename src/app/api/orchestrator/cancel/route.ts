// POST /api/orchestrator/cancel  { runId }
// Owner-initiated cancel of an in-flight run (SPEC §9.3). Signals the Modal runtime to stop
// cleanly (in-flight tool call finishes; nothing new fires) and marks the run canceled. The
// reserved agent-minutes stay metered — cancel still consumed compute (PA-ORCH-5 "never sell
// unbounded compute"), so we don't refund them.

import { createClient } from "@/lib/supabase/server";
import { fetchRun, updateRun } from "@/lib/orchestrator/db";
import { requestCancel } from "@/lib/orchestrator/runtime-client";
import { isTerminalStatus } from "@/lib/orchestrator/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CancelSchema = z.object({ runId: z.string().uuid() });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let runId: string;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    runId = CancelSchema.parse(raw).runId;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const run = await fetchRun(runId);
  if (!run || run.business_id !== user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (isTerminalStatus(run.status)) {
    return NextResponse.json({ error: `Run already ${run.status}` }, { status: 409 });
  }

  // Best-effort runtime signal — the run row is the source of truth either way.
  await requestCancel(runId);
  const updated = await updateRun(runId, {
    status: "canceled",
    resultSummary: run.result_summary ?? "Canceled by owner.",
  });

  return NextResponse.json({ run: updated });
}
