// POST /api/app/decisions/[id]/advance — runs ONE unit of the debate: the next argue-round (all arguing
// agents in parallel), or the Moderator's verdict once every round is in. The card calls this in a loop
// until the roundtable reaches verdict_ready, so turns stream in and the owner can interject between
// rounds. An optimistic lock (run_lock_at) makes a double-call a no-op rather than a double-spend.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getRoundtable,
  getTurns,
  insertTurns,
  updateRoundtable,
  claimAdvanceLock,
  releaseAdvanceLock,
  type InsertTurnInput,
} from "@/lib/decisions/db";
import { resolveBackings } from "@/lib/decisions/providers";
import { detectVerticalForOwner } from "@/lib/decisions/verticals";
import { buildBrainContext, runArgumentTurn, runModeratorTurn } from "@/lib/decisions/run";
import { transcriptLine } from "@/lib/decisions/roles";
import type { ArguingRole, RoundtableRole, RoundtableTurn } from "@/lib/decisions/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One round (2-3 parallel agent calls) or the Moderator — comfortably under this, but give headroom.
export const maxDuration = 120;

function buildTranscript(turns: RoundtableTurn[]): string {
  return turns.map((t) => transcriptLine(t.role, t.round_index, t.content)).join("\n\n");
}

// Smallest argue-round in [0,total) where not every arguing role has a turn yet — i.e. the next round to
// run. Returns total when every argue-round is complete (→ time for the Moderator).
function nextRoundIndex(turns: RoundtableTurn[], arguingRoles: ArguingRole[], total: number): number {
  for (let r = 0; r < total; r++) {
    const present = new Set(turns.filter((t) => t.round_index === r).map((t) => t.role));
    if (!arguingRoles.every((role) => present.has(role))) return r;
  }
  return total;
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rtResult = await getRoundtable(params.id, user.id);
  if (!rtResult.ok) return NextResponse.json({ error: rtResult.error }, { status: rtResult.status });
  const roundtable = rtResult.data;
  if (!roundtable) return NextResponse.json({ error: "Roundtable not found" }, { status: 404 });

  // Terminal already → just hand back the current state (the card stops looping on non-running status).
  if (roundtable.status !== "running") {
    const turns = await getTurns(params.id, user.id);
    return NextResponse.json({ status: roundtable.status, turns: turns.ok ? turns.data : [] });
  }

  // Claim the run. A second concurrent advance loses the claim and returns the current state without
  // re-spending — the guard against a double-mount / rapid re-poll double-firing the LLM rounds.
  const lock = await claimAdvanceLock(params.id, user.id);
  if (!lock.ok) return NextResponse.json({ error: lock.error }, { status: lock.status });
  if (!lock.data) {
    const turns = await getTurns(params.id, user.id);
    return NextResponse.json({ status: "running", turns: turns.ok ? turns.data : [], busy: true });
  }

  try {
    const paResult = await fetchPaUser(user.id);
    if (!paResult.ok || !paResult.data?.anthropic_api_key) {
      await updateRoundtable(params.id, user.id, { status: "cancelled" });
      return NextResponse.json({ error: "no_api_key" }, { status: 402 });
    }
    const { anthropic_api_key, brain_repo, github_token } = paResult.data;

    // Re-derive the roster (deterministic) so per-role backings stay stable across rounds without a
    // stored mapping. The vertical match is content-deterministic against the brain.
    const vertical = await detectVerticalForOwner(roundtable.question, brain_repo, github_token);
    const arguingRoles: ArguingRole[] = vertical
      ? ["steelman", "devils_advocate", "domain_specialist"]
      : ["steelman", "devils_advocate"];
    const allRoles: RoundtableRole[] = [...arguingRoles, "moderator"];

    const resolved = await resolveBackings(user.id, anthropic_api_key, allRoles);
    if (!resolved) {
      await updateRoundtable(params.id, user.id, { status: "cancelled" });
      return NextResponse.json({ error: "no_provider" }, { status: 402 });
    }

    const turnsResult = await getTurns(params.id, user.id);
    if (!turnsResult.ok) return NextResponse.json({ error: turnsResult.error }, { status: turnsResult.status });
    const existing = turnsResult.data;
    const maxTurnIndex = existing.reduce((m, t) => Math.max(m, t.turn_index), -1);
    const brainContext = await buildBrainContext(brain_repo, github_token);
    const transcript = buildTranscript(existing);

    const round = nextRoundIndex(existing, arguingRoles, roundtable.total_rounds);

    if (round < roundtable.total_rounds) {
      // Run the next argue-round: every arguing agent in parallel (they read prior turns, not each
      // other's current turn). An owner interjection queued for this round is highlighted to each agent.
      const interjection =
        existing
          .filter((t) => t.role === "owner_interjection" && t.round_index === round)
          .map((t) => t.content)
          .join("\n") || null;

      const results = await Promise.all(
        arguingRoles.map((role) =>
          runArgumentTurn({
            role,
            target: resolved.backings[role] ?? resolved.fallback,
            fallback: resolved.fallback,
            question: roundtable.question,
            brainContext,
            transcript,
            interjection,
            vertical,
            roundIndex: round,
            ownerId: user.id,
            roundtableId: params.id,
            conversationId: roundtable.conversation_id,
          }).then((r) => ({ role, ...r })),
        ),
      );

      const toInsert: InsertTurnInput[] = results.map((r, i) => ({
        roundtableId: params.id,
        ownerId: user.id,
        role: r.role,
        modelBacking: r.backing,
        roundIndex: round,
        turnIndex: maxTurnIndex + 1 + i,
        content: r.content,
      }));
      const inserted = await insertTurns(toInsert);
      if (!inserted.ok) return NextResponse.json({ error: inserted.error }, { status: inserted.status });

      const all = await getTurns(params.id, user.id);
      return NextResponse.json({ status: "running", turns: all.ok ? all.data : [...existing, ...inserted.data] });
    }

    // Every argue-round is in → run the Moderator once and flip to verdict_ready.
    const mod = await runModeratorTurn({
      target: resolved.backings.moderator ?? resolved.fallback,
      fallback: resolved.fallback,
      question: roundtable.question,
      brainContext,
      transcript,
      ownerId: user.id,
      roundtableId: params.id,
      conversationId: roundtable.conversation_id,
    });
    const inserted = await insertTurns([
      {
        roundtableId: params.id,
        ownerId: user.id,
        role: "moderator",
        modelBacking: mod.backing,
        roundIndex: roundtable.total_rounds,
        turnIndex: maxTurnIndex + 1,
        content: mod.content,
      },
    ]);
    if (!inserted.ok) return NextResponse.json({ error: inserted.error }, { status: inserted.status });

    await updateRoundtable(params.id, user.id, {
      status: "verdict_ready",
      completedAt: new Date().toISOString(),
    });
    const all = await getTurns(params.id, user.id);
    return NextResponse.json({ status: "verdict_ready", turns: all.ok ? all.data : [], verdict: mod.verdict });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Roundtable advance failed" },
      { status: 502 },
    );
  } finally {
    // Always release the claim so the next round can run (or a retry can re-claim after a failure).
    await releaseAdvanceLock(params.id, user.id).catch(() => undefined);
  }
}
