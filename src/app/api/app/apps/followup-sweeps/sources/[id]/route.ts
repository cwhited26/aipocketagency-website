// /api/app/apps/followup-sweeps/sources/[id] — update (enable / dormancy / config) or delete a watch.
// Owner-scoped: db helpers gate every write by owner_id, and the session supplies it.

import { createClient } from "@/lib/supabase/server";
import { deleteSource, getSource, updateSource } from "@/lib/followup-sweeps/db";
import type { FollowupSourceConfig } from "@/lib/followup-sweeps/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  dormancyDays: z.number().int().min(1).max(365).optional(),
  label: z.string().min(1).max(120).optional(),
  brainDir: z.string().min(1).max(200).optional(),
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

  const patch: Parameters<typeof updateSource>[2] = {};
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.dormancyDays !== undefined) patch.dormancy_days = parsed.data.dormancyDays;

  // A label/brainDir change has to merge into the existing source_config, so read it first.
  if (parsed.data.label !== undefined || parsed.data.brainDir !== undefined) {
    const current = await getSource(params.id, user.id);
    if (!current.ok) return NextResponse.json({ error: current.error }, { status: current.status });
    if (!current.data) return NextResponse.json({ error: "Source not found" }, { status: 404 });
    const config: FollowupSourceConfig = { ...current.data.source_config };
    if (parsed.data.label !== undefined) config.label = parsed.data.label.trim();
    if (parsed.data.brainDir !== undefined) config.brainDir = parsed.data.brainDir.trim();
    patch.source_config = config;
  }

  const result = await updateSource(params.id, user.id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ source: result.data });
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

  const result = await deleteSource(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
