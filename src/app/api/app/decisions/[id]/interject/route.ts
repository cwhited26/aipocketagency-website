// POST /api/app/decisions/[id]/interject — the owner types into the live card to push back, add missing
// context, or redirect an agent (PA-DR principle 4). The interjection is persisted as an
// owner_interjection turn queued for the NEXT argue-round; /advance folds it into that round's input for
// every agent. Only valid while the debate is still running.

import { createClient } from "@/lib/supabase/server";
import { getRoundtable, getTurns, insertTurn } from "@/lib/decisions/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ content: z.string().min(1).max(4_000) });

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

  const rt = await getRoundtable(params.id, user.id);
  if (!rt.ok) return NextResponse.json({ error: rt.error }, { status: rt.status });
  if (!rt.data) return NextResponse.json({ error: "Roundtable not found" }, { status: 404 });
  if (rt.data.status !== "running") {
    return NextResponse.json({ error: "This roundtable isn't live anymore." }, { status: 409 });
  }

  const turns = await getTurns(params.id, user.id);
  if (!turns.ok) return NextResponse.json({ error: turns.error }, { status: turns.status });

  // Queue the interjection for the upcoming round: one past the highest argue-round seen so far. The
  // agents that haven't argued that round yet pick it up; the transcript carries it to every later round.
  const maxArgRound = turns.data
    .filter((t) => t.role !== "owner_interjection" && t.role !== "moderator")
    .reduce((m, t) => Math.max(m, t.round_index), -1);
  const maxTurnIndex = turns.data.reduce((m, t) => Math.max(m, t.turn_index), -1);

  const result = await insertTurn({
    roundtableId: params.id,
    ownerId: user.id,
    role: "owner_interjection",
    modelBacking: "owner",
    roundIndex: maxArgRound + 1,
    turnIndex: maxTurnIndex + 1,
    content: parsed.data.content.trim(),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ turn: result.data });
}
