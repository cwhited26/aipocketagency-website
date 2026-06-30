// /api/app/apps/website-monitor — list the owner's watched URLs (GET) and add one (POST).
// Add is tier-capped on active URLs (Personal Brain 1 / Business Agent 5 / mid 20 / Studio+ unlimited).

import { createClient } from "@/lib/supabase/server"
import { countActiveWebsites, createWebsite, listWebsites } from "@/lib/website-monitor/db"
import { monitoredWebsiteInputSchema } from "@/lib/website-monitor/types"
import { evaluateCanAddMonitoredWebsite, getCurrentTier } from "@/lib/personas/tier-caps"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await listWebsites(user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ websites: result.data })
}

export async function POST(req: Request): Promise<NextResponse> {
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

  const parsed = monitoredWebsiteInputSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }

  const tier = await getCurrentTier(user.id)
  const active = await countActiveWebsites(user.id)
  if (!active.ok) return NextResponse.json({ error: active.error }, { status: active.status })
  const cap = evaluateCanAddMonitoredWebsite(tier, active.data)
  if (!cap.ok) return NextResponse.json({ error: "cap_reached", message: cap.reason }, { status: 403 })

  const result = await createWebsite(user.id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ website: result.data }, { status: 201 })
}
