import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner } from "@/lib/personas/owner";
import { canCreatePersona, getCurrentTier, TIER_LABELS, TIER_LIMITS } from "@/lib/personas/tier-caps";
import { listPersonasForBusiness, PersonaDbError } from "@/lib/personas/db";
import { getTemplate } from "@/lib/personas/templates";
import { createPersonaFromTemplate } from "@/lib/personas/create";
import { sanitizeAppIds } from "@/lib/apps/catalog";
import { customFieldsSchema, personaNameSchema, toneSchema } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  templateKey: z.string().min(1).max(40),
  name: personaNameSchema,
  tone: toneSchema,
  customFields: customFieldsSchema.default({}),
  // The Apps (the WHAT) this persona can use. Sanitized against the catalog server-side;
  // when omitted, the template's defaults are used.
  accessibleApps: z.array(z.string().max(40)).max(40).optional(),
});

export async function GET(): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  try {
    const personas = await listPersonasForBusiness(owner.ctx.userId);
    const tier = await getCurrentTier(owner.ctx.userId);
    const limit = TIER_LIMITS[tier].personas;
    return NextResponse.json({
      personas,
      tier,
      tierLabel: TIER_LABELS[tier],
      personaLimit: limit,
      canCreate: limit === null || personas.length < limit,
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  const { ctx } = owner;
  if (!ctx.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

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
  const { templateKey, name, tone, customFields, accessibleApps } = parsed.data;

  const template = getTemplate(templateKey);
  if (!template) return NextResponse.json({ error: "Unknown template" }, { status: 422 });

  // Apps the persona can use: caller selection if provided, else the template's defaults.
  // Always sanitized against the catalog so an unknown id can never be persisted.
  const apps = sanitizeAppIds(accessibleApps ?? template.defaultApps);

  try {
    const cap = await canCreatePersona(ctx.userId);
    if (!cap.ok) return NextResponse.json({ error: cap.reason, capped: true }, { status: 403 });

    // The shared creation sequence (spec file → zone → row → v1 spec) — the same path the
    // vertical-onboarding seeder uses (lib/personas/create.ts).
    let result;
    try {
      result = await createPersonaFromTemplate({
        ctx: { userId: ctx.userId, brainRepo: ctx.brainRepo, githubToken: ctx.githubToken },
        template,
        name,
        tone,
        customFields,
        apps,
      });
    } catch (e) {
      if (e instanceof PersonaDbError && (e.status === 409 || /duplicate|23505/.test(e.message))) {
        return NextResponse.json(
          { error: "You already have a persona with that name. Pick a different name." },
          { status: 409 },
        );
      }
      throw e;
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ persona: result.persona }, { status: 201 });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}
