// POST /api/app/apps/idea-engine/ideas — drop a new idea (stage 1, Capture).
// GET  /api/app/apps/idea-engine/ideas — list the owner's ideas (active + archived).
//
// Pro+ and above only (PA-IDEA-3). The drop creates the idea row + the Snapshot folder; stage 2+
// runs are fired from the run-stage route.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsIdeaEngine } from "@/lib/personas/tier-caps";
import { dropIdea } from "@/lib/idea-engine/engine";
import { listIdeas } from "@/lib/idea-engine/store";
import { IDEA_SOURCES } from "@/lib/idea-engine/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  title: z.string().min(2).max(160),
  detail: z.string().max(8000).default(""),
  source: z.enum(IDEA_SOURCES as unknown as [string, ...string[]]).default("typed"),
  sourceUrl: z.string().max(1000).optional(),
});

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsIdeaEngine(tier)) {
    return NextResponse.json({ error: "The Idea Engine is a Pro+ feature." }, { status: 403 });
  }
  const res = await listIdeas(user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ideas: res.data });
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsIdeaEngine(tier)) {
    return NextResponse.json({ error: "The Idea Engine is a Pro+ feature." }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const pa = await fetchPaUser(user.id);
  if (!pa.ok || !pa.data) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const result = await dropIdea({
    ownerId: user.id,
    title: parsed.data.title,
    source: parsed.data.source as (typeof IDEA_SOURCES)[number],
    detail: parsed.data.detail,
    sourcePayload: parsed.data.sourceUrl ? { sourceUrl: parsed.data.sourceUrl } : {},
    paUser: pa.data,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ idea: result.data }, { status: 201 });
}
