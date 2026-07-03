// POST /api/app/decisions/start — start a Decision Roundtable on an owner's question (PA-DR). Validates
// the Studio+ gate + the monthly run cap, resolves a diverse model backing per role, creates the
// roundtable row, and drops a live card into the originating chat thread. It does NOT run any LLM — the
// debate advances one round per /advance call so turns stream in and stay interruptible (PA-DR §9).
// Never auto-spawns: this fires only on the owner's explicit "Run Decision Roundtable" tap.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { insertMessage } from "@/lib/pa-conversations";
import { getCurrentTier, evaluateCanRunRoundtable } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { decrementPassRunBudget } from "@/lib/metering/store";
import { scoreDecisionHeuristics } from "@/lib/decisions/classify";
import { detectVerticalForOwner } from "@/lib/decisions/verticals";
import { resolveBackings, backingLabel } from "@/lib/decisions/providers";
import { createRoundtable, countRoundtablesThisMonth } from "@/lib/decisions/db";
import { DECISION_ROUNDTABLE_KIND } from "@/lib/decisions/card";
import type { RoundtableRole } from "@/lib/decisions/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOTAL_ROUNDS = 3;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  question: z.string().min(1).max(10_000),
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  const { conversationId, question } = parsed.data;

  // Tier gate + monthly cap (PA-DR-1 / §11), widened by Project Pass (PA-POS-31): a pass buys
  // one debate — its run budget, not the tier's monthly cap, bounds it. The cap count and tier
  // are read together so the refusal reason is specific (upgrade teaser vs cap-reached).
  const tier = await getCurrentTier(user.id);
  const access = await hasAppEntitlement(user.id, "roundtable", { tier });
  const passEntitled = access.source === "project_pass";
  if (!passEntitled) {
    const monthCount = await countRoundtablesThisMonth(user.id);
    const gate = evaluateCanRunRoundtable(tier, monthCount.ok ? monthCount.data : 0);
    if (!gate.ok) {
      return NextResponse.json({ error: "not_allowed", message: gate.reason, tier }, { status: 403 });
    }
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.anthropic_api_key) {
    return NextResponse.json(
      { error: "no_api_key", message: "Add your Anthropic API key in Settings to run a roundtable." },
      { status: 402 },
    );
  }
  const { anthropic_api_key, brain_repo, github_token } = paResult.data;

  // Domain Specialist auto-routes only when the question matches a vertical the brain has material for
  // (PA-DR-2). The arguing roster grows to four when it does.
  const vertical = await detectVerticalForOwner(question, brain_repo, github_token);
  const arguingRoles: RoundtableRole[] = vertical
    ? ["steelman", "devils_advocate", "domain_specialist"]
    : ["steelman", "devils_advocate"];
  const roles: RoundtableRole[] = [...arguingRoles, "moderator"];

  const resolved = await resolveBackings(user.id, anthropic_api_key, roles);
  if (!resolved) {
    return NextResponse.json(
      { error: "no_provider", message: "No usable model provider is configured." },
      { status: 402 },
    );
  }
  const modelBackings = Array.from(new Set(roles.map((r) => backingLabel(resolved.backings[r] ?? resolved.fallback))));

  const heur = scoreDecisionHeuristics(question);
  const created = await createRoundtable({
    ownerId: user.id,
    conversationId,
    question,
    decisionType: heur.decisionType,
    stakesLevel: heur.stakesLevel,
    modelBackings,
    totalRounds: TOTAL_ROUNDS,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  const roundtable = created.data;

  // A pass-entitled debate is the pass's "one debate" — burn the run budget at creation, so the
  // whole debate (all rounds + verdict) rides on it without a mid-debate stop (PA-POS-31).
  if (passEntitled && access.pass && access.pass.remainingRunBudget !== null) {
    await decrementPassRunBudget(access.pass.id);
  }

  // Drop the live card into the thread so the debate streams in-place. It rides message.metadata (the
  // same jsonb seam upload/YouTube cards use); the DecisionRoundtableCard reads the id and polls.
  const cardMsg = await insertMessage({
    conversationId,
    userId: user.id,
    role: "assistant",
    content: "Running a Decision Roundtable on this — your agents are arguing it out.",
    metadata: {
      kind: DECISION_ROUNDTABLE_KIND,
      roundtableId: roundtable.id,
      question,
      totalRounds: TOTAL_ROUNDS,
    },
  });
  if (!cardMsg.ok) {
    return NextResponse.json({ error: cardMsg.error }, { status: cardMsg.status });
  }

  return NextResponse.json({
    roundtable,
    vertical,
    cardMessage: cardMsg.data,
  });
}
