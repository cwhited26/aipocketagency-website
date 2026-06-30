// PATCH  /api/app/personas/[id]/soul/[soulId]   — edit one Soul attribute's summary/body
// POST   /api/app/personas/[id]/soul/[soulId]   — lock / unlock (toggle decay exemption)
// DELETE /api/app/personas/[id]/soul/[soulId]   — forget (retire/supersede) one attribute
//
// The three owner controls (Soul System SPEC §Owner controls). All are scoped to the persona AND
// verified owned, so a stray id can never touch another persona's — or another owner's — Soul. "Forget"
// retires (supersedes) the attribute rather than hard-deleting, keeping the Soul's history intact.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import {
  fetchSoulById,
  retireSoulAttribute,
  setSoulLocked,
  updateSoulFields,
} from "@/lib/personas/soul-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string; soulId: string } };

/** Resolve the owner, assert they own the persona, and assert the attribute belongs to that persona. */
async function guard(params: Params["params"]) {
  const owner = await resolveOwner();
  if (!owner.ok) return { ok: false as const, status: owner.status, error: owner.error };

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return { ok: false as const, status: owned.status, error: owned.error };

  const found = await fetchSoulById(params.soulId);
  if (!found.ok) return { ok: false as const, status: found.status, error: found.error };
  if (!found.data || found.data.persona_id !== params.id) {
    return { ok: false as const, status: 404, error: "Attribute not found" };
  }
  return { ok: true as const };
}

const EditSchema = z.object({
  summary: z.string().trim().min(1).max(240).optional(),
  body: z.string().trim().max(4_000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const g = await guard(params);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = EditSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  if (parsed.data.summary === undefined && parsed.data.body === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 422 });
  }

  const res = await updateSoulFields(params.soulId, params.id, {
    ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
    ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: "updated" });
}

const LockSchema = z.object({ locked: z.boolean() });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const g = await guard(params);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = LockSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const res = await setSoulLocked(params.soulId, params.id, parsed.data.locked);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: parsed.data.locked ? "locked" : "unlocked" });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const g = await guard(params);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const res = await retireSoulAttribute(params.soulId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: "forgotten" });
}
