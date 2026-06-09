// POST /api/orchestrator/gates/<inboxItemId>  { decision: "revise" | "reject" | "approve_anyway" }
// Resolves a held gate_findings card (SPEC §9, PA-GATE-5). `id` is the pa_inbox_items row id.
//  • reject          — kill the whole Project (run → canceled).
//  • revise          — send the plan back to be rewritten: consume the card, cancel the held run,
//                      and return a suggested revised goal built from the gates' suggested fixes so
//                      the owner can re-issue it with the fixes baked in (NOT auto-fix — owner stays
//                      in the loop, SPEC §5).
//  • approve_anyway  — override + fire. Allowed ONLY when EVERY flagged/blocked gate on the card is
//                      overridable (its trust window cleared, auto-dismiss on, not a Security
//                      hard-fail, not an error) AND that toggle is still on now. A day-1 owner can't
//                      wave anything through.
//
// Ownership is enforced in code: the inbox item's user_id must equal the caller.

import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import { fetchGateOverride } from "@/lib/orchestrator/gates/db";
import { isFindingOverridable } from "@/lib/orchestrator/gates/trust";
import { GATE_NAMES, type GateName } from "@/lib/orchestrator/gates/schema";
import type { GateCardPayload } from "@/lib/orchestrator/gates/card";
import { resumeRunAfterGate } from "@/lib/orchestrator/dispatcher";
import { updateRun } from "@/lib/orchestrator/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  decision: z.enum(["revise", "reject", "approve_anyway"]),
});

function isGateName(v: string): v is GateName {
  return (GATE_NAMES as readonly string[]).includes(v);
}

function readPayload(raw: unknown): GateCardPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.projectId !== "string" || !Array.isArray(p.gates)) return null;
  return p as unknown as GateCardPayload;
}

/** The blocking (non-pass) gates on a card. */
function blockingGates(payload: GateCardPayload): GateCardPayload["gates"] {
  return payload.gates.filter((g) => g.status !== "pass");
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const inboxRes = await fetchInboxItemById(params.id);
  if (!inboxRes.ok) return NextResponse.json({ error: inboxRes.error }, { status: inboxRes.status });
  const item = inboxRes.data;
  if (!item || item.user_id !== user.id || item.kind !== "gate_findings") {
    return NextResponse.json({ error: "Gate findings not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Already ${item.status}` }, { status: 409 });
  }

  const payload = readPayload(item.payload);
  if (!payload) return NextResponse.json({ error: "Gate card payload unreadable" }, { status: 422 });

  // ── reject: kill the Project ───────────────────────────────────────────────────────────
  if (body.decision === "reject") {
    await resolveInboxItem(item.id, "rejected", user.id);
    if (payload.projectId) {
      await updateRun(payload.projectId, {
        status: "canceled",
        resultSummary: "Project rejected by owner at the Gate Phase.",
      }).catch(() => null);
    }
    return NextResponse.json({ status: "rejected" });
  }

  // ── revise: consume the card, cancel the held run, hand back a fix-laden goal ───────────
  if (body.decision === "revise") {
    await resolveInboxItem(item.id, "rejected", user.id);
    if (payload.projectId) {
      await updateRun(payload.projectId, {
        status: "canceled",
        resultSummary: "Plan sent back for revision at the Gate Phase.",
      }).catch(() => null);
    }
    const fixes = blockingGates(payload)
      .map((g) => (g.finding ? `- ${g.label}: ${g.finding.suggested_fix}` : `- ${g.label}: revise`))
      .join("\n");
    const revisionPrompt =
      `${payload.projectTitle}\n\nApply these fixes before planning:\n${fixes}`.slice(0, 4_000);
    return NextResponse.json({ status: "revise", revisionPrompt });
  }

  // ── approve_anyway: override + fire, only if every blocking gate is overridable NOW ─────
  const blocking = blockingGates(payload);
  const locked: string[] = [];
  for (const g of blocking) {
    if (!g.name || !isGateName(g.name)) {
      locked.push(g.label || g.name);
      continue;
    }
    // Re-check live: the stamped `overridable` reflects the streak at run time; confirm the owner
    // hasn't since turned the toggle off (and re-derive against the current row).
    const row = await fetchGateOverride(user.id, g.name).catch(() => null);
    const live = isFindingOverridable({
      gate: g.name,
      status: g.status,
      cleanPassCount: row?.clean_pass_count ?? 0,
      autoDismissEnabled: row?.auto_dismiss_enabled ?? false,
    });
    if (!(g.overridable && live)) locked.push(g.label || g.name);
  }
  if (locked.length > 0) {
    return NextResponse.json(
      {
        error: `Approve-anyway is locked for: ${locked.join(", ")}. Revise or reject instead.`,
        locked,
      },
      { status: 403 },
    );
  }

  await resolveInboxItem(item.id, "approved", user.id);
  const resumed = await resumeRunAfterGate(payload.projectId);
  if (!resumed.ok) {
    return NextResponse.json({ status: "approved", fired: false, note: resumed.reason });
  }
  return NextResponse.json({ status: "approved", fired: resumed.fired, note: resumed.reason });
}
