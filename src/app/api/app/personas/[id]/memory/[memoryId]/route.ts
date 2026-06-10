// POST   /api/app/personas/[id]/memory/[memoryId]   — supersede (retire) one memory
// DELETE /api/app/personas/[id]/memory/[memoryId]   — hard-delete one memory
//
// Owner controls per-row (PA-MEM-5): "supersede" retires the memory from the live set but keeps it for
// audit; "delete" removes it. Both are scoped to the persona AND verified owned, so a stray id can
// never touch another persona's — or another owner's — memory.

import { NextResponse } from "next/server";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import { deleteMemory, fetchMemoryById, retireMemory } from "@/lib/persona-memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string; memoryId: string } };

/** Resolve the owner, assert they own the persona, and assert the memory belongs to that persona. */
async function guard(params: Params["params"]) {
  const owner = await resolveOwner();
  if (!owner.ok) return { ok: false as const, status: owner.status, error: owner.error };

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return { ok: false as const, status: owned.status, error: owned.error };

  const found = await fetchMemoryById(params.memoryId);
  if (!found.ok) return { ok: false as const, status: found.status, error: found.error };
  if (!found.data || found.data.persona_id !== params.id) {
    return { ok: false as const, status: 404, error: "Memory not found" };
  }
  return { ok: true as const };
}

export async function POST(_req: Request, { params }: Params): Promise<NextResponse> {
  const g = await guard(params);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const res = await retireMemory(params.memoryId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: "superseded" });
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const g = await guard(params);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const res = await deleteMemory(params.memoryId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: "deleted" });
}
