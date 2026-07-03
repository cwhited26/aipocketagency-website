// POST /api/app/apps/idea-engine/ideas/[id] — lifecycle action on an idea.
// Body: { action: "archive" | "fork" }. Re-running a stage lives on the run-stage route.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsIdeaEngine } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { archiveIdea, forkIdea } from "@/lib/idea-engine/engine";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ action: z.enum(["archive", "fork"]) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tier OR active Project Pass (PA-POS-31) — the widened gate.
  const tier = await getCurrentTier(user.id);
  const access = await hasAppEntitlement(user.id, "idea_engine", { tier });
  if (!tierAllowsIdeaEngine(tier) && access.source !== "project_pass") {
    return NextResponse.json(
      { error: "The Idea Engine is a Pro+ feature — or grab a Project Pass on the App page." },
      { status: 403 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  if (parsed.data.action === "archive") {
    const res = await archiveIdea(user.id, params.id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ idea: res.data });
  }

  // fork
  const pa = await fetchPaUser(user.id);
  if (!pa.ok || !pa.data) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const res = await forkIdea({ ownerId: user.id, ideaId: params.id, paUser: pa.data });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ idea: res.data }, { status: 201 });
}
