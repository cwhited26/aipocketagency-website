// GET /api/cron/browser-worker — the Browser Agent tick (every minute via vercel.json).
// Claims up to WORKER_JOBS_PER_TICK live jobs (queued / running / awaiting_approval) behind a
// per-row lease so overlapping ticks never drive the same browser session, then advances each
// within its budget. Long missions ride many ticks; the state lives on the job row.

import { NextResponse } from "next/server";
import { claimDueBrowserJobs } from "@/lib/browser-agent/db";
import { advanceJob } from "@/lib/browser-agent/worker";
import { makeWorkerDeps } from "@/lib/browser-agent/worker-deps";
import {
  WORKER_JOBS_PER_TICK,
  WORKER_JOB_TICK_BUDGET_MS,
} from "@/lib/browser-agent/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const claimed = await claimDueBrowserJobs(WORKER_JOBS_PER_TICK);
  if (!claimed.ok) {
    console.error("[cron/browser-worker] claim failed", { error: claimed.error });
    return NextResponse.json({ ok: false, error: "claim failed" }, { status: 500 });
  }
  if (claimed.data.length === 0) {
    return NextResponse.json({ ok: true, jobs: 0 });
  }

  const deps = makeWorkerDeps();
  const outcomes = [];
  for (const job of claimed.data) {
    outcomes.push(await advanceJob(job, deps, WORKER_JOB_TICK_BUDGET_MS));
  }

  return NextResponse.json({
    ok: true,
    jobs: outcomes.length,
    outcomes: outcomes.map((o) => ({
      jobId: o.jobId,
      status: o.status,
      steps: o.stepsAdvanced,
      note: o.note,
    })),
  });
}
