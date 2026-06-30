// sweep.ts — the cron worker. Every 5 minutes it polls the URLs that are due, records each check (for
// the uptime sparkline), stages a website_alert Mission Control card when something the owner asked to
// be told about changed, and logs a zero-cost usage event per tick. Never throws — a single bad URL
// can't sink the sweep.

import { createInboxItem } from "@/lib/pa-inbox-items"
import { logCostEvent } from "@/lib/cost/log"
import { detectAlerts } from "./diff"
import { listActiveWebsites, recordCheck } from "./db"
import { pollUrl } from "./poll"
import { monitorLog } from "./log"
import type { MonitoredWebsite, WebsiteAlert } from "./types"

/** Pure: is this active URL due for a poll given its interval and last check time? */
export function isDue(site: MonitoredWebsite, now: Date): boolean {
  if (!site.lastCheckAt) return true
  const last = new Date(site.lastCheckAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last >= site.checkIntervalSeconds * 1000
}

const SWEEP_LIMIT = 200

export type SweepSummary = { scanned: number; checked: number; alertsStaged: number }

export async function runMonitorSweep(now: Date = new Date()): Promise<SweepSummary> {
  const active = await listActiveWebsites(SWEEP_LIMIT)
  if (!active.ok) {
    monitorLog.error("sweep: could not load active websites", { status: active.status, error: active.error })
    return { scanned: 0, checked: 0, alertsStaged: 0 }
  }

  const due = active.data.filter((s) => isDue(s, now))
  let checked = 0
  let alertsStaged = 0

  for (const site of due) {
    const result = await pollUrl(site.url)
    checked += 1

    const alerts = detectAlerts(site, result, now)

    const recorded = await recordCheck(site, result)
    if (!recorded.ok) {
      monitorLog.warn("sweep: recordCheck failed", { websiteId: site.id, status: recorded.status })
    }

    // Usage accounting only — a poll is negligible spend, so cost is 0. The event still counts toward
    // usage limits. Idempotent per-minute so a cron retry inside the same minute collapses to one row.
    await logCostEvent({
      ownerId: site.ownerId,
      featureSlug: "website_monitor",
      backend: "vercel",
      costMicroCents: 0,
      idempotencyKey: `website_monitor:${site.id}:${now.toISOString().slice(0, 16)}`,
      metadata: { website_id: site.id, status: String(result.status ?? "error") },
    })

    if (alerts.length > 0) {
      const staged = await stageAlertCard(site, alerts)
      if (staged) alertsStaged += 1
    }
  }

  monitorLog.info("sweep complete", { scanned: active.data.length, checked, alertsStaged })
  return { scanned: active.data.length, checked, alertsStaged }
}

async function stageAlertCard(site: MonitoredWebsite, alerts: WebsiteAlert[]): Promise<boolean> {
  let host = site.url
  try {
    host = new URL(site.url).host
  } catch {
    // keep the raw URL
  }

  const bodyMd = [`**${host}** — ${alerts.length === 1 ? "1 alert" : `${alerts.length} alerts`}:`, "", ...alerts.map((a) => `- ${a.summary}`), "", `Checked URL: ${site.url}`].join("\n")

  const res = await createInboxItem({
    userId: site.ownerId,
    kind: "website_alert",
    title: `Website alert: ${host}`,
    bodyMd,
    source: "website-monitor",
    payload: {
      websiteId: site.id,
      url: site.url,
      alerts: alerts.map((a) => ({ kind: a.kind, summary: a.summary })),
      host,
    },
  })
  if (!res.ok) {
    monitorLog.error("sweep: could not stage alert card", { websiteId: site.id, status: res.status, error: res.error })
    return false
  }
  return true
}
