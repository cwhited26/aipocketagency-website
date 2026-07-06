// POST /api/workshop/attendance — the player heartbeat (PA-POS-38 §24.6). Every ~15s the player
// posts the current video position; the login_to_pa button posts connected_to_pa=true; leaving
// the page posts exit=true. All merges onto the single attendance row.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWorkshopRegistration,
  upsertWorkshopAttendance,
  type WorkshopAttendanceRow,
} from "@/lib/workshop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  registration_id: z.string().uuid(),
  position_sec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  connected_to_pa: z.boolean().optional(),
  exit: z.boolean().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const body = parsed.data;

  const reg = await getWorkshopRegistration(body.registration_id);
  if (!reg.ok || !reg.data) {
    return NextResponse.json({ error: "unknown registration" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const patch: Partial<Omit<WorkshopAttendanceRow, "registration_id">> = {
    last_active_at: nowIso,
  };
  if (typeof body.position_sec === "number") patch.current_video_position_sec = body.position_sec;
  if (body.connected_to_pa === true) patch.connected_to_pa = true;
  if (body.exit === true) patch.exit_at = nowIso;

  const saved = await upsertWorkshopAttendance(body.registration_id, patch);
  if (!saved.ok) {
    console.error("[workshop/attendance] upsert failed", {
      registration_id: body.registration_id,
      status: saved.status,
      error: saved.error,
    });
    return NextResponse.json({ error: "could not record" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
