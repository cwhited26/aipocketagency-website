// GET /api/cron/watchdog  (Vercel Cron, every minute)
// The Mission Control Watchdog (PA-MC-6): reclaim sub-agent runs that went silent. The runtime
// stamps last_heartbeat_at on every webhook event; if a live run hasn't checked in for >60s the
// runtime is presumed dead and the run is flipped to 'zombie' + needs_human so it surfaces in the
// Attention section instead of sitting "running" forever. Idempotent — a run already terminal or
// already zombie is excluded by the sweep's status filter, so a re-run flips nothing twice.

import { NextResponse } from "next/server";
import { flipStaleRunsToZombie, OrchestratorDbError } from "@/lib/orchestrator/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Heartbeat-staleness window. A run that hasn't reported in this long is presumed dead.
const HEARTBEAT_STALE_MS = 60_000;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - HEARTBEAT_STALE_MS).toISOString();

  try {
    const reclaimed = await flipStaleRunsToZombie(staleBefore, now.toISOString());
    return NextResponse.json({
      ok: true,
      reclaimed: reclaimed.length,
      runIds: reclaimed.map((r) => r.id),
    });
  } catch (e) {
    // Wave B ships dark behind PA_ORCHESTRATOR_ENABLED; the orchestrator schema (migration 021)
    // can legitimately not be provisioned yet. Treat that as "nothing to sweep", not a 500.
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) {
      return NextResponse.json({ ok: true, reclaimed: 0, schema: "not_provisioned" });
    }
    const message = e instanceof Error ? e.message : "Watchdog sweep failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
