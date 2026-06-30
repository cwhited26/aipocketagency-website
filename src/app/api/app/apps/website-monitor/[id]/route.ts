// /api/app/apps/website-monitor/[id] — edit settings / pause / resume (PATCH) and delete (DELETE).
// Ownership is gated in the DB query (owner_id=eq). Resuming a paused URL re-checks the active cap.

import { createClient } from "@/lib/supabase/server"
import { countActiveWebsites, deleteWebsite, getWebsite, updateWebsite } from "@/lib/website-monitor/db"
import { CHECK_INTERVALS_SECONDS, type CheckIntervalSeconds } from "@/lib/website-monitor/types"
import { evaluateCanAddMonitoredWebsite, getCurrentTier } from "@/lib/personas/tier-caps"
import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  url: z.string().url().max(2048).optional(),
  checkIntervalSeconds: z
    .number()
    .int()
    .refine((n): n is CheckIntervalSeconds => (CHECK_INTERVALS_SECONDS as readonly number[]).includes(n), {
      message: "check_interval_seconds must be one of 300, 900, 3600, 21600",
    })
    .optional(),
  alertOnStatusChange: z.boolean().optional(),
  alertOnContentChange: z.boolean().optional(),
  alertOnSlowResponse: z.boolean().optional(),
  alertOnSslExpiryDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
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

  const existing = await getWebsite(user.id, params.id)
  if (!existing.ok) return NextResponse.json({ error: existing.error }, { status: existing.status })
  if (!existing.data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Resuming a paused URL makes it active again — re-check the cap so resume can't blow past the plan.
  if (parsed.data.isActive === true && !existing.data.isActive) {
    const tier = await getCurrentTier(user.id)
    const active = await countActiveWebsites(user.id)
    if (!active.ok) return NextResponse.json({ error: active.error }, { status: active.status })
    const cap = evaluateCanAddMonitoredWebsite(tier, active.data)
    if (!cap.ok) return NextResponse.json({ error: "cap_reached", message: cap.reason }, { status: 403 })
  }

  const result = await updateWebsite(user.id, params.id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ website: result.data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteWebsite(user.id, params.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
