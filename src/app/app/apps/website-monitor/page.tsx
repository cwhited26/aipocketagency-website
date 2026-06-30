import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { listChecks, listWebsites } from "@/lib/website-monitor/db"
import {
  evaluateCanAddMonitoredWebsite,
  getCurrentTier,
  websiteMonitorCap,
} from "@/lib/personas/tier-caps"
import { redirect } from "next/navigation"
import WebsiteMonitorClient, { type WebsiteView } from "./WebsiteMonitorClient"

export const dynamic = "force-dynamic"

const SPARKLINE_POINTS = 30

export default async function WebsiteMonitorPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/app/login")

  const result = await fetchPaUser(user.id)
  const paUser = result.ok ? result.data : null
  if (!paUser) redirect("/app/onboarding")

  const tier = await getCurrentTier(user.id)
  const sitesResult = await listWebsites(user.id)
  const sites = sitesResult.ok ? sitesResult.data : []

  // Pull each URL's recent check history for the uptime sparkline (cheap — indexed, capped).
  const histories = await Promise.all(
    sites.map((s) => listChecks(user.id, s.id, SPARKLINE_POINTS)),
  )

  const websites: WebsiteView[] = sites.map((s, i) => {
    const points = histories[i].ok ? histories[i].data : []
    return {
      id: s.id,
      url: s.url,
      checkIntervalSeconds: s.checkIntervalSeconds,
      alertOnStatusChange: s.alertOnStatusChange,
      alertOnContentChange: s.alertOnContentChange,
      alertOnSlowResponse: s.alertOnSlowResponse,
      alertOnSslExpiryDays: s.alertOnSslExpiryDays,
      lastCheckAt: s.lastCheckAt,
      lastStatus: s.lastStatus,
      lastResponseMs: s.lastResponseMs,
      lastSslExpiresAt: s.lastSslExpiresAt,
      isActive: s.isActive,
      history: points.map((p) => ({ ok: p.ok, responseMs: p.responseMs })),
    }
  })

  const activeCount = sites.filter((s) => s.isActive).length
  const cap = websiteMonitorCap(tier)
  const canAdd = evaluateCanAddMonitoredWebsite(tier, activeCount).ok

  return (
    <WebsiteMonitorClient
      websites={websites}
      cap={Number.isFinite(cap) ? cap : null}
      activeCount={activeCount}
      canAdd={canAdd}
    />
  )
}
