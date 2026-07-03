// POST /api/app/personas/[id]/soul/suggest — the "Suggest improvements" box (Soul System SPEC §Owner
// controls). The owner drops a free-form note ("you're too apologetic; cut the 'I think' from your
// drafts") and the extractor turns it into Soul attributes. This is the EXPLICIT extraction trigger:
// gated only by tierAllowsSoulExtraction (the owner is directly asking), not by the per-Persona opt-in.
// Read-only Personal tier can't spend a model call, so it's refused with the upgrade reason.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import { getPersonaDisplayName } from "@/lib/personas/types";
import { getCurrentTier, tierAllowsSoulExtraction } from "@/lib/personas/tier-caps";
import { defaultSoulExtractLlm, runSoulExtraction } from "@/lib/personas/soul-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: { id: string } };

const BodySchema = z.object({ note: z.string().trim().min(1).max(4_000) });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const tier = await getCurrentTier(owner.ctx.userId);
  if (!tierAllowsSoulExtraction(tier)) {
    return NextResponse.json(
      {
        error:
          "Suggesting improvements is a Business Agent feature. On your plan you can still add Soul attributes by hand.",
      },
      { status: 403 },
    );
  }
  if (!owner.ctx.anthropicKey) {
    return NextResponse.json(
      { error: "Add your model key in Settings before suggesting improvements." },
      { status: 409 },
    );
  }

  const llm = defaultSoulExtractLlm(owner.ctx.anthropicKey, {
    ownerId: owner.ctx.userId,
    featureSlug: "soul_extraction",
    idempotencyKey: `soul-suggest:${params.id}:${Date.now()}`,
  });

  const summary = await runSoulExtraction({
    persona: { id: owned.persona.id, name: getPersonaDisplayName(owned.persona), mode: owned.persona.mode },
    ownerId: owner.ctx.userId,
    tier,
    trigger: "explicit",
    conversation: parsed.data.note,
    outcome: "This is a direct note the owner wrote about how they want to be worked with.",
    llm,
  });

  if ("skipped" in summary) {
    return NextResponse.json({ status: "skipped", reason: summary.skipped });
  }

  const written = summary.results.filter((r) => r.action === "auto_written").length;
  const staged = summary.results.filter((r) => r.action === "staged").length;
  return NextResponse.json({ status: "ok", written, staged, total: summary.results.length });
}
