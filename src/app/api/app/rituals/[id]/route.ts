// /api/app/rituals/[id] — get one ritual (with its run history), edit it, or delete it.
//
// Edit covers the fields the owner authored: the name, the schedule (re-parsed, which recomputes
// next_run_at), the delivery, and the per-ritual note. Enable/pause is its own route. Owner-scoped: the
// db helpers gate every read and write by owner_id, and the session supplies it.

import { createClient } from "@/lib/supabase/server";
import { deleteRitual, getRitual, listRitualRuns, updateRitual, type RitualPatch } from "@/lib/rituals/db";
import { cronNextRun, parseSchedule } from "@/lib/rituals/parser";
import { isRitualDelivery } from "@/lib/rituals/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ritual = await getRitual(params.id, user.id);
  if (!ritual.ok) return NextResponse.json({ error: ritual.error }, { status: ritual.status });
  if (!ritual.data) return NextResponse.json({ error: "Ritual not found" }, { status: 404 });

  const runs = await listRitualRuns(params.id);
  return NextResponse.json({ ritual: ritual.data, runs: runs.ok ? runs.data : [] });
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  scheduleText: z.string().min(1).max(160).optional(),
  delivery: z.string().refine(isRitualDelivery, "Invalid delivery").optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const current = await getRitual(params.id, user.id);
  if (!current.ok) return NextResponse.json({ error: current.error }, { status: current.status });
  if (!current.data) return NextResponse.json({ error: "Ritual not found" }, { status: 404 });

  const patch: RitualPatch = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.delivery !== undefined) {
    patch.delivery = parsed.data.delivery === "email_digest" ? "email_digest" : "inbox";
  }

  if (parsed.data.scheduleText !== undefined) {
    const schedule = parseSchedule(parsed.data.scheduleText);
    if (!schedule.ok) {
      return NextResponse.json({ error: "needs_schedule", message: schedule.reason }, { status: 422 });
    }
    const next = cronNextRun(schedule.schedule.cron, new Date(), {
      biWeekly: schedule.schedule.biWeekly,
      lastRunAt: null,
    });
    if (!next) return NextResponse.json({ error: "Couldn't compute that schedule." }, { status: 422 });
    patch.scheduleCron = schedule.schedule.cron;
    patch.scheduleNaturalText = parsed.data.scheduleText.trim();
    patch.biWeeklySkip = schedule.schedule.biWeekly;
    patch.nextRunAt = next.toISOString();
  }

  if (parsed.data.note !== undefined) {
    const appPayload: Record<string, unknown> = { ...current.data.app_payload };
    const note = parsed.data.note.trim();
    if (note) appPayload.note = note;
    else delete appPayload.note;
    patch.appPayload = appPayload;
  }

  const result = await updateRitual(params.id, user.id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ritual: result.data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await deleteRitual(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
