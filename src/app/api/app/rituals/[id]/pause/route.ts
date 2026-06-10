// /api/app/rituals/[id]/pause — pause or resume a ritual (PA-RITUAL-8).
//
// Pausing sets enabled=false (a paused ritual doesn't count against the active cap and the sweep skips
// it). Resuming re-checks the active cap (an enabled ritual counts again), clears the failure streak,
// and recomputes next_run_at from now so a long-paused ritual fires on its next scheduled slot rather
// than immediately on a stale past cursor. Owner-scoped via the session + the owner-gated db helpers.

import { createClient } from "@/lib/supabase/server";
import { countActiveRituals, getRitual, updateRitual, type RitualPatch } from "@/lib/rituals/db";
import { cronNextRun } from "@/lib/rituals/parser";
import { evaluateCanActivateRitual, getCurrentTier } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const current = await getRitual(params.id, user.id);
  if (!current.ok) return NextResponse.json({ error: current.error }, { status: current.status });
  if (!current.data) return NextResponse.json({ error: "Ritual not found" }, { status: 404 });

  const patch: RitualPatch = { enabled: parsed.data.enabled };

  if (parsed.data.enabled) {
    // Resuming re-activates the ritual — re-check the cap, but don't count this paused one against it.
    if (!current.data.enabled) {
      const tier = await getCurrentTier(user.id);
      const active = await countActiveRituals(user.id);
      if (!active.ok) return NextResponse.json({ error: active.error }, { status: active.status });
      const cap = evaluateCanActivateRitual(tier, active.data);
      if (!cap.ok) return NextResponse.json({ error: "cap_reached", message: cap.reason }, { status: 403 });
    }
    patch.resetFailures = true;
    const next = cronNextRun(current.data.schedule_cron, new Date(), {
      biWeekly: current.data.bi_weekly_skip,
      lastRunAt: current.data.last_run_at ? new Date(current.data.last_run_at) : null,
    });
    if (next) patch.nextRunAt = next.toISOString();
  }

  const result = await updateRitual(params.id, user.id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ritual: result.data });
}
