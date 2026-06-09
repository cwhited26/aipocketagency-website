import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner } from "@/lib/personas/owner";
import { canCreatePersona, getCurrentTier, TIER_LABELS, TIER_LIMITS } from "@/lib/personas/tier-caps";
import {
  insertPersona,
  insertSpec,
  listPersonasForBusiness,
  PersonaDbError,
  updatePersona,
} from "@/lib/personas/db";
import { applyTemplate, getTemplate } from "@/lib/personas/templates";
import { sanitizeAppIds } from "@/lib/apps/catalog";
import { buildPersonaSpecMarkdown } from "@/lib/personas/spec";
import {
  customFieldsSchema,
  personaNameSchema,
  personaScope,
  personaSpecPath,
  personaZoneKey,
  personaZonePattern,
  slugifyPersonaName,
  toneSchema,
} from "@/lib/personas/types";
import { commitMemoryFile } from "@/lib/pa-brain";
import { loadZoneConfig, saveZoneConfig, withZone } from "@/lib/brain/containment-guard";

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

    const slug = slugifyPersonaName(name);
    const specFields = applyTemplate({ template, personaName: name, customFields });
    const specMarkdown = buildPersonaSpecMarkdown(specFields);
    const specPath = personaSpecPath(slug);
    const zoneKey = personaZoneKey(slug);

    // 1. Write the spec file (persona.md) into the brain repo.
    const specWrite = await commitMemoryFile({
      repo: ctx.brainRepo,
      token: ctx.githubToken,
      path: specPath,
      mode: "replace",
      content: specMarkdown,
      commitMessage: `persona: create ${personaScope(slug)} from template ${templateKey}`,
    });
    if (!specWrite.ok) {
      return NextResponse.json({ error: specWrite.error }, { status: 502 });
    }

    // 2. Declare the persona's ContainmentGuard zone (knowledge folder).
    const { config } = await loadZoneConfig(ctx.brainRepo, ctx.githubToken);
    const nextConfig = withZone(config, zoneKey, [personaZonePattern(slug)]);
    const zoneWrite = await saveZoneConfig({
      repo: ctx.brainRepo,
      token: ctx.githubToken,
      config: nextConfig,
    });
    if (!zoneWrite.ok) {
      return NextResponse.json({ error: zoneWrite.error }, { status: 502 });
    }

    // 3. Create the persona row.
    let persona;
    try {
      persona = await insertPersona({
        business_id: ctx.userId,
        owner_user_id: ctx.userId,
        name,
        slug,
        template_key: templateKey,
        tone,
        status: "active",
        spec_path: specPath,
        knowledge_zone_key: zoneKey,
        accessible_apps: apps,
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

    // 4. Insert the immutable v1 spec row and point the persona at it.
    const spec = await insertSpec({
      persona_id: persona.id,
      version: 1,
      body_md: specMarkdown,
      created_by: ctx.userId,
    });
    const updated = await updatePersona(persona.id, { current_spec_version: spec.id });

    return NextResponse.json({ persona: updated ?? persona }, { status: 201 });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}
