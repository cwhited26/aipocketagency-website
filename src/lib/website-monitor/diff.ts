// diff.ts — status-diff logic (pure, unit-tested in isolation).
//
// Given a watched URL's stored last-state and a fresh check result, decide which (if any) website_alert
// reasons fire. Each reason is gated by the per-URL toggle the owner set. First checks (no baseline)
// never fire a status-change or content-change alert — there's nothing to diff against — but the
// absolute checks (slow response, SSL expiry) can still fire on the very first poll.

import { SLOW_RESPONSE_THRESHOLD_MS, type CheckResult, type MonitoredWebsite, type WebsiteAlert } from "./types"
import { expiryPhrase, isSslExpiringSoon } from "./ssl"

/** A status is "up" when it answered 2xx or 3xx. Everything else (4xx/5xx) is "down". */
export function isUpStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 400
}

/**
 * Compute the website_alert reasons for one check. Pure: takes the prior state off the site row and the
 * fresh result, returns zero or more alerts. `now` is injected so the SSL math is deterministic in tests.
 */
export function detectAlerts(
  site: MonitoredWebsite,
  result: CheckResult,
  now: Date,
): WebsiteAlert[] {
  const alerts: WebsiteAlert[] = []
  const host = safeHost(site.url)

  // ── Status change — only with a baseline, and only when up/down classification flips ──
  if (site.alertOnStatusChange && site.lastStatus !== null) {
    const wasUp = isUpStatus(site.lastStatus)
    const nowUp = isUpStatus(result.status)
    if (wasUp !== nowUp) {
      const detail = result.status === null
        ? result.error ?? "no response"
        : `HTTP ${result.status}`
      alerts.push({
        kind: "status_change",
        summary: nowUp
          ? `${host} is back up (${detail}) — was down at HTTP ${site.lastStatus}.`
          : `${host} went down: ${detail} (was HTTP ${site.lastStatus}).`,
      })
    }
  }

  // ── Slow response — absolute, fires on the first check too ──
  if (site.alertOnSlowResponse && result.ok && result.responseMs > SLOW_RESPONSE_THRESHOLD_MS) {
    alerts.push({
      kind: "slow_response",
      summary: `${host} responded in ${(result.responseMs / 1000).toFixed(1)}s — over the ${(
        SLOW_RESPONSE_THRESHOLD_MS / 1000
      ).toFixed(0)}s threshold.`,
    })
  }

  // ── Content drift — only when the owner opted this URL into alert-on-change, with a baseline hash ──
  if (
    site.alertOnContentChange &&
    site.lastContentHash !== null &&
    result.contentHash !== null &&
    site.lastContentHash !== result.contentHash
  ) {
    alerts.push({
      kind: "content_change",
      summary: `${host} content changed since the last check.`,
    })
  }

  // ── SSL expiry — absolute, fires on the first check too ──
  const expiresAt = result.sslExpiresAt ? new Date(result.sslExpiresAt) : null
  if (isSslExpiringSoon(expiresAt, now, site.alertOnSslExpiryDays) && expiresAt) {
    alerts.push({
      kind: "ssl_expiry",
      summary: `${host} TLS certificate ${expiryPhrase(expiresAt, now)} (alerting under ${site.alertOnSslExpiryDays} days).`,
    })
  }

  return alerts
}

/** The hostname for alert copy, falling back to the raw URL when it can't be parsed. */
function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
