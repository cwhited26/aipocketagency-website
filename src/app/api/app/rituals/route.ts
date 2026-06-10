// /api/app/rituals — list the owner's rituals, and create one (PA-RITUAL-3/7/8).
//
// Two create modes share one POST: a manual ritual (the owner typed a name, picked an App, and typed a
// schedule) and a seed install (the owner tapped "install" on one of the 8 templates). Both run the
// tier cap on ACTIVE rituals before inserting, since a fresh ritual is enabled. The manual mode runs the
// owner's schedule text through the natural-language parser; a parse miss returns needs_schedule so the
// UI shows the day/time picker (never a raw-cron prompt). Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { countActiveRituals, createRitual, listRituals, type CreateRitualParams } from "@/lib/rituals/db";
import { parseSchedule, cronNextRun } from "@/lib/rituals/parser";
import { getSeed, resolveRitualTarget } from "@/lib/rituals/seed";
import { isRitualDelivery, type RitualDelivery } from "@/lib/rituals/types";
import { evaluateCanActivateRitual, getCurrentTier } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listRituals(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ rituals: result.data });
}

const manualSchema = z.object({
  mode: z.literal("manual").optional(),
  name: z.string().min(1).max(120),
  appSlug: z.string().min(1).max(80),
  scheduleText: z.string().min(1).max(160),
  delivery: z.string().refine(isRitualDelivery, "Invalid delivery").optional(),
  note: z.string().max(500).optional(),
});

const seedSchema = z.object({
  mode: z.literal("seed"),
  seedId: z.string().min(1).max(80),
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

  // Tier cap on ACTIVE rituals (PA-RITUAL-8): a new ritual is enabled, so check before building it.
  const tier = await getCurrentTier(user.id);
  const active = await countActiveRituals(user.id);
  if (!active.ok) return NextResponse.json({ error: active.error }, { status: active.status });
  const cap = evaluateCanActivateRitual(tier, active.data);
  if (!cap.ok) {
    return NextResponse.json({ error: "cap_reached", message: cap.reason }, { status: 403 });
  }

  const isSeed = typeof raw === "object" && raw !== null && (raw as { mode?: string }).mode === "seed";
  const params = isSeed ? buildSeedParams(user.id, raw) : buildManualParams(user.id, raw);
  if (!params.ok) return NextResponse.json(params.body, { status: params.status });

  const result = await createRitual(params.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ritual: result.data }, { status: 201 });
}

type BuildResult =
  | { ok: true; data: CreateRitualParams }
  | { ok: false; status: number; body: Record<string, unknown> };

function buildSeedParams(ownerId: string, raw: unknown): BuildResult {
  const parsed = seedSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 422, body: { error: parsed.error.message } };

  const seed = getSeed(parsed.data.seedId);
  if (!seed) return { ok: false, status: 404, body: { error: "Unknown seed template" } };

  const next = cronNextRun(seed.cron, new Date(), { biWeekly: seed.biWeekly, lastRunAt: null });
  if (!next) return { ok: false, status: 422, body: { error: "Couldn't compute the seed's schedule." } };

  return {
    ok: true,
    data: {
      ownerId,
      name: seed.name,
      appSlug: seed.appSlug,
      projectPlanId: null,
      appPayload: {},
      scheduleCron: seed.cron,
      scheduleNaturalText: seed.scheduleText,
      biWeeklySkip: seed.biWeekly,
      delivery: seed.delivery,
      nextRunAt: next.toISOString(),
    },
  };
}

function buildManualParams(ownerId: string, raw: unknown): BuildResult {
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 422, body: { error: parsed.error.message } };

  if (!resolveRitualTarget(parsed.data.appSlug)) {
    return { ok: false, status: 422, body: { error: "Pick an App for this ritual to run." } };
  }

  const schedule = parseSchedule(parsed.data.scheduleText);
  if (!schedule.ok) {
    // The picker path (PA-RITUAL-3): tell the client to collect a day + time, never a raw cron.
    return { ok: false, status: 422, body: { error: "needs_schedule", message: schedule.reason } };
  }

  const next = cronNextRun(schedule.schedule.cron, new Date(), {
    biWeekly: schedule.schedule.biWeekly,
    lastRunAt: null,
  });
  if (!next) return { ok: false, status: 422, body: { error: "Couldn't compute that schedule." } };

  const delivery: RitualDelivery = parsed.data.delivery === "email_digest" ? "email_digest" : "inbox";
  const appPayload: Record<string, unknown> = {};
  if (parsed.data.note && parsed.data.note.trim()) appPayload.note = parsed.data.note.trim();

  return {
    ok: true,
    data: {
      ownerId,
      name: parsed.data.name.trim(),
      appSlug: parsed.data.appSlug,
      projectPlanId: null,
      appPayload,
      scheduleCron: schedule.schedule.cron,
      // Preserve the owner's typed phrase verbatim (SPEC §5).
      scheduleNaturalText: parsed.data.scheduleText.trim(),
      biWeeklySkip: schedule.schedule.biWeekly,
      delivery,
      nextRunAt: next.toISOString(),
    },
  };
}
