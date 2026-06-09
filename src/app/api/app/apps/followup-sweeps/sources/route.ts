// /api/app/apps/followup-sweeps/sources — list + create the owner's Follow-Up Sweeps watches.
//
// A "source" is one configured watch: a source_type (gmail / brain_customer / lead_scout), a
// relationship category that drives the tone + default dormancy, and a label. Create seeds the
// relationship's default dormancy unless the owner overrides it. Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { createSource, listSources } from "@/lib/followup-sweeps/db";
import type { FollowupSourceConfig } from "@/lib/followup-sweeps/types";
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

  const result = await listSources(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ sources: result.data });
}

const createSchema = z.object({
  sourceType: z.enum(["gmail", "brain_customer", "lead_scout"]),
  label: z.string().min(1).max(120),
  relationship: z.enum(["cold_lead", "active_customer", "past_customer"]),
  dormancyDays: z.number().int().min(1).max(365).optional(),
  // brain_customer only — the brain folder of customer files to scan.
  brainDir: z.string().min(1).max(200).optional(),
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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const config: FollowupSourceConfig = {
    label: parsed.data.label.trim(),
    relationship: parsed.data.relationship,
  };
  if (parsed.data.sourceType === "brain_customer" && parsed.data.brainDir) {
    config.brainDir = parsed.data.brainDir.trim();
  }

  const result = await createSource({
    ownerId: user.id,
    sourceType: parsed.data.sourceType,
    config,
    dormancyDays: parsed.data.dormancyDays,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ source: result.data }, { status: 201 });
}
