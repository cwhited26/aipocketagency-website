// /api/app/apps/proposals/[id] — edit the markdown / move status (stage, archive) (PATCH) and delete.
// Ownership is gated in the DB query (owner_id=eq).

import { createClient } from "@/lib/supabase/server"
import { deleteProposal, getProposal, updateProposal } from "@/lib/proposals/db"
import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  generatedMarkdown: z.string().max(60000).optional(),
  // The owner can stage (ready to send), archive, or return a sent/staged proposal to draft.
  status: z.enum(["draft", "staged", "archived"]).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }

  const existing = await getProposal(user.id, params.id)
  if (!existing.ok) return NextResponse.json({ error: existing.error }, { status: existing.status })
  if (!existing.data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await updateProposal(user.id, params.id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ proposal: result.data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteProposal(user.id, params.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
