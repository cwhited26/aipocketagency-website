// GET /api/app/mission-control
// The live snapshot behind Mission Control's header strip + run-based sections (Attention,
// Active right now, Verifying, Scheduled, recently Done). The "Awaiting your decision" sections
// (email triage / approvals / drafts / quick decisions) still come from /api/app/inbox — this
// route owns the orchestrator-run + scheduled-routine view that the old Inbox never had.
//
// The orchestrator schema (migration 021) ships dark behind PA_ORCHESTRATOR_ENABLED and may not
// be provisioned. A missing runs table is degraded to "no runs" (the routine-based Scheduled +
// Idle tiles still work) rather than a 500.

import { createClient } from "@/lib/supabase/server";
import { listRunsForBusiness, OrchestratorDbError } from "@/lib/orchestrator/db";
import { maxConcurrentRunsPerUser } from "@/lib/orchestrator/feature-flag";
import { listRoutines } from "@/lib/pa-routines";
import { projectMissionControl, type MissionControlSnapshot } from "@/lib/mission-control/projection";
import type { SubAgentRunRow } from "@/lib/orchestrator/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MissionControlResponse = MissionControlSnapshot & {
  /** False when the orchestrator schema isn't provisioned — the run sections are empty by design. */
  runsProvisioned: boolean;
};

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let runs: SubAgentRunRow[] = [];
  let runsProvisioned = true;
  try {
    runs = await listRunsForBusiness(user.id, 100);
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) {
      runsProvisioned = false;
    } else {
      const message = e instanceof Error ? e.message : "Failed to load runs";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Routines live in their own table (migration 009) — always present. Best-effort: a routine
  // read failure degrades the Scheduled/Idle tiles to empty, never blocks the run sections.
  const routinesResult = await listRoutines(user.id);
  const routines = routinesResult.ok ? routinesResult.data : [];

  const snapshot = projectMissionControl({
    runs,
    routines,
    concurrencyCap: maxConcurrentRunsPerUser(),
    nowMs: Date.now(),
  });

  return NextResponse.json({ ...snapshot, runsProvisioned } satisfies MissionControlResponse);
}
