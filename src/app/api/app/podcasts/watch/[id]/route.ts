// /api/app/podcasts/watch/[id]
//   PATCH  → update a watch (owner-scoped): { paused? } and/or { cadence? } and/or { notesOnly? }.
//   DELETE → "stop watching" (removes the row).
// Pause/resume = paused; the cadence pill = cadence; the notes-only toggle = notesOnly.

import { createClient } from "@/lib/supabase/server";
import { setWatchPaused, setWatchCadence, setWatchNotesOnly, deleteWatch } from "@/lib/podcasts/watch";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    paused: z.boolean().optional(),
    cadence: z.enum(["realtime", "daily", "weekly"]).optional(),
    notesOnly: z.boolean().optional(),
  })
  .refine((v) => v.paused !== undefined || v.cadence !== undefined || v.notesOnly !== undefined, {
    message: "Provide paused, cadence, and/or notesOnly",
  });

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { paused? cadence? notesOnly? }" }, { status: 422 });
  }

  const nowIso = new Date().toISOString();
  let updated = null;

  if (parsed.data.cadence) {
    const r = await setWatchCadence(user.id, params.id, parsed.data.cadence, nowIso);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    updated = r.data;
  }
  if (parsed.data.notesOnly !== undefined) {
    const r = await setWatchNotesOnly(user.id, params.id, parsed.data.notesOnly);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    updated = r.data;
  }
  if (parsed.data.paused !== undefined) {
    const r = await setWatchPaused(user.id, params.id, parsed.data.paused, nowIso);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    updated = r.data;
  }

  return NextResponse.json({ ok: true, watch: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await deleteWatch(user.id, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
