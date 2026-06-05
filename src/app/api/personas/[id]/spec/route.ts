import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  fetchSpec,
  insertSpec,
  listSpecs,
  maxSpecVersion,
  PersonaDbError,
  updatePersona,
} from "@/lib/personas/db";
import {
  buildPersonaSpecMarkdown,
  parsePersonaSpecMarkdown,
  PERSONA_SECTION_KEYS,
} from "@/lib/personas/spec";
import { commitMemoryFile } from "@/lib/pa-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET — list every spec version (newest first) with parsed fields for the picker.
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const specs = await listSpecs(params.id);
    return NextResponse.json({
      currentSpecVersion: owned.persona.current_spec_version,
      versions: specs.map((s) => ({
        id: s.id,
        version: s.version,
        createdAt: s.created_at,
        fields: parsePersonaSpecMarkdown(s.body_md),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

const fieldsSchema = z.record(z.enum(PERSONA_SECTION_KEYS as [string, ...string[]]), z.string().max(20_000));

const postSchema = z.object({ fields: fieldsSchema });

// POST — save an edited spec as a NEW immutable version and make it current.
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.ctx.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const markdown = buildPersonaSpecMarkdown(parsed.data.fields);
    const write = await commitMemoryFile({
      repo: owner.ctx.brainRepo,
      token: owner.ctx.githubToken,
      path: persona.spec_path,
      mode: "replace",
      content: markdown,
      commitMessage: `persona: edit spec ${persona.spec_path}`,
    });
    if (!write.ok) return NextResponse.json({ error: write.error }, { status: 502 });

    const nextVersion = (await maxSpecVersion(persona.id)) + 1;
    const spec = await insertSpec({
      persona_id: persona.id,
      version: nextVersion,
      body_md: markdown,
      created_by: owner.ctx.userId,
    });
    await updatePersona(persona.id, { current_spec_version: spec.id });

    return NextResponse.json({ specId: spec.id, version: spec.version }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({ specId: z.string().uuid() });

// PATCH — roll back: point current_spec_version at a prior version and rewrite the
// brain spec file to match (so the human-readable file stays in sync with what runs).
export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.ctx.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const target = await fetchSpec(parsed.data.specId);
    if (!target || target.persona_id !== persona.id) {
      return NextResponse.json({ error: "Spec version not found" }, { status: 404 });
    }

    const write = await commitMemoryFile({
      repo: owner.ctx.brainRepo,
      token: owner.ctx.githubToken,
      path: persona.spec_path,
      mode: "replace",
      content: target.body_md,
      commitMessage: `persona: roll back spec ${persona.spec_path} to v${target.version}`,
    });
    if (!write.ok) return NextResponse.json({ error: write.error }, { status: 502 });

    await updatePersona(persona.id, { current_spec_version: target.id });
    return NextResponse.json({ specId: target.id, version: target.version });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown): NextResponse {
  const status = e instanceof PersonaDbError ? e.status : 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status },
  );
}
