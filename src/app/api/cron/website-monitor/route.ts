// /api/cron/website-monitor — polls every due watched URL and stages website_alert cards.
// Registered in vercel.json at */5. Authenticates with CRON_SECRET (Authorization: Bearer …).

import { NextResponse } from "next/server"
import { runMonitorSweep } from "@/lib/website-monitor/sweep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await runMonitorSweep()
  return NextResponse.json({ ok: true, ...summary })
}
