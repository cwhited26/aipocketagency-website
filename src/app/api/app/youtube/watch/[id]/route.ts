// PATCH /api/app/youtube/watch/[id] — update a watch (owner-scoped).
// Body: { status?: 'active'|'paused'|'stopped' } and/or { cadence?: 'realtime'|'daily'|'weekly' }.
// "Stop watching" = status:'stopped'; pause/resume = status; the cadence pill = cadence.

import { createClient } from "@/lib/supabase/server";
import { setWatchStatus, setWatchCadence } from "@/lib/youtube/watch";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(["active", "paused", "stopped"]).optional(),
    cadence: z.enum(["realtime", "daily", "weekly"]).optional(),
  })
  .refine((v) => v.status !== undefined || v.cadence !== undefined, {
    message: "Provide status and/or cadence",
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { status? cadence? }" }, { status: 422 });
  }

  const nowIso = new Date().toISOString();
  let updated = null;

  if (parsed.data.cadence) {
    const r = await setWatchCadence(user.id, params.id, parsed.data.cadence, nowIso);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    updated = r.data;
  }
  if (parsed.data.status) {
    const r = await setWatchStatus(user.id, params.id, parsed.data.status, nowIso);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    updated = r.data;
  }

  return NextResponse.json({ ok: true, watch: updated });
}
