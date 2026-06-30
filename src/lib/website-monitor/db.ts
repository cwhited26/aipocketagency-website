// db.ts — PostgREST data access for the Website Monitoring App (direct REST, no SDK). Service-role
// key; every owner-scoped read/write gates on owner_id in the query string. Typed results, never throws.

import type { CheckResult, MonitoredWebsite, MonitoredWebsiteInput } from "./types"

export type MonitorResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY
  if (!url || !key) return { error: "Supabase service-role env vars not set" }
  return { url: url.replace(/\/$/, ""), key }
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }
}

type WebsiteRow = {
  id: string
  owner_id: string
  url: string
  check_interval_seconds: number
  alert_on_status_change: boolean
  alert_on_content_change: boolean
  alert_on_slow_response: boolean
  alert_on_ssl_expiry_days: number
  last_check_at: string | null
  last_status: number | null
  last_response_ms: number | null
  last_content_hash: string | null
  last_ssl_expires_at: string | null
  is_active: boolean
  created_at: string
}

function rowToSite(r: WebsiteRow): MonitoredWebsite {
  return {
    id: r.id,
    ownerId: r.owner_id,
    url: r.url,
    checkIntervalSeconds: r.check_interval_seconds,
    alertOnStatusChange: r.alert_on_status_change,
    alertOnContentChange: r.alert_on_content_change,
    alertOnSlowResponse: r.alert_on_slow_response,
    alertOnSslExpiryDays: r.alert_on_ssl_expiry_days,
    lastCheckAt: r.last_check_at,
    lastStatus: r.last_status,
    lastResponseMs: r.last_response_ms,
    lastContentHash: r.last_content_hash,
    lastSslExpiresAt: r.last_ssl_expires_at,
    isActive: r.is_active,
  }
}

export async function listWebsites(ownerId: string): Promise<MonitorResult<MonitoredWebsite[]>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: ((await res.json()) as WebsiteRow[]).map(rowToSite) }
}

export async function getWebsite(ownerId: string, id: string): Promise<MonitorResult<MonitoredWebsite | null>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const rows = (await res.json()) as WebsiteRow[]
  return { ok: true, data: rows.length ? rowToSite(rows[0]) : null }
}

export async function countActiveWebsites(ownerId: string): Promise<MonitorResult<number>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?owner_id=eq.${encodeURIComponent(ownerId)}&is_active=eq.true&select=id`,
    { headers: { ...authHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const range = res.headers.get("content-range") // e.g. "0-4/5"
  const total = range && range.includes("/") ? Number(range.split("/")[1]) : ((await res.json()) as unknown[]).length
  return { ok: true, data: Number.isFinite(total) ? total : 0 }
}

export async function createWebsite(
  ownerId: string,
  input: MonitoredWebsiteInput,
): Promise<MonitorResult<MonitoredWebsite>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(`${env.url}/rest/v1/pa_monitored_websites`, {
    method: "POST",
    headers: { ...authHeaders(env.key), Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: ownerId,
      url: input.url,
      check_interval_seconds: input.checkIntervalSeconds,
      alert_on_status_change: input.alertOnStatusChange,
      alert_on_content_change: input.alertOnContentChange,
      alert_on_slow_response: input.alertOnSlowResponse,
      alert_on_ssl_expiry_days: input.alertOnSslExpiryDays,
    }),
  })
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: rowToSite(((await res.json()) as WebsiteRow[])[0]) }
}

/** Patch the owner-editable fields (settings) or the is_active flag (pause/resume). */
export async function updateWebsite(
  ownerId: string,
  id: string,
  patch: Partial<MonitoredWebsiteInput> & { isActive?: boolean },
): Promise<MonitorResult<MonitoredWebsite | null>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const body: Record<string, unknown> = {}
  if (patch.url !== undefined) body.url = patch.url
  if (patch.checkIntervalSeconds !== undefined) body.check_interval_seconds = patch.checkIntervalSeconds
  if (patch.alertOnStatusChange !== undefined) body.alert_on_status_change = patch.alertOnStatusChange
  if (patch.alertOnContentChange !== undefined) body.alert_on_content_change = patch.alertOnContentChange
  if (patch.alertOnSlowResponse !== undefined) body.alert_on_slow_response = patch.alertOnSlowResponse
  if (patch.alertOnSslExpiryDays !== undefined) body.alert_on_ssl_expiry_days = patch.alertOnSslExpiryDays
  if (patch.isActive !== undefined) body.is_active = patch.isActive
  if (Object.keys(body).length === 0) return getWebsite(ownerId, id)

  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const rows = (await res.json()) as WebsiteRow[]
  return { ok: true, data: rows.length ? rowToSite(rows[0]) : null }
}

export async function deleteWebsite(ownerId: string, id: string): Promise<MonitorResult<true>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE", headers: authHeaders(env.key) },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: true }
}

/**
 * Active rows for the cron, ordered oldest-checked first (never-checked rows sort first because
 * last_check_at is null). The cron filters these to the ones actually due by interval in JS.
 */
export async function listActiveWebsites(limit: number): Promise<MonitorResult<MonitoredWebsite[]>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?is_active=eq.true&order=last_check_at.asc.nullsfirst&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: ((await res.json()) as WebsiteRow[]).map(rowToSite) }
}

/** Record one check tick: append a history row (for the sparkline) and update the site's last_* state. */
export async function recordCheck(site: MonitoredWebsite, result: CheckResult): Promise<MonitorResult<true>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const checkedAt = new Date().toISOString()

  const historyRes = await fetch(`${env.url}/rest/v1/pa_website_checks`, {
    method: "POST",
    headers: authHeaders(env.key),
    body: JSON.stringify({
      website_id: site.id,
      owner_id: site.ownerId,
      checked_at: checkedAt,
      ok: result.ok,
      status: result.status,
      response_ms: result.responseMs,
    }),
  })
  if (!historyRes.ok) return { ok: false, status: historyRes.status, error: await historyRes.text() }

  const stateRes = await fetch(
    `${env.url}/rest/v1/pa_monitored_websites?id=eq.${encodeURIComponent(site.id)}`,
    {
      method: "PATCH",
      headers: authHeaders(env.key),
      body: JSON.stringify({
        last_check_at: checkedAt,
        last_status: result.status,
        last_response_ms: result.responseMs,
        // Keep the prior hash when this poll couldn't read a body, so a transient failure doesn't
        // reset the content-drift baseline and cause a false "changed" on the next good poll.
        last_content_hash: result.contentHash ?? site.lastContentHash,
        last_ssl_expires_at: result.sslExpiresAt ?? site.lastSslExpiresAt,
      }),
    },
  )
  if (!stateRes.ok) return { ok: false, status: stateRes.status, error: await stateRes.text() }
  return { ok: true, data: true }
}

export type CheckHistoryPoint = { checkedAt: string; ok: boolean; status: number | null; responseMs: number | null }

/** Most-recent check history for one URL, oldest→newest (for the uptime sparkline). */
export async function listChecks(
  ownerId: string,
  websiteId: string,
  limit: number,
): Promise<MonitorResult<CheckHistoryPoint[]>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_website_checks?website_id=eq.${encodeURIComponent(websiteId)}&owner_id=eq.${encodeURIComponent(
      ownerId,
    )}&order=checked_at.desc&limit=${limit}&select=checked_at,ok,status,response_ms`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const rows = (await res.json()) as Array<{ checked_at: string; ok: boolean; status: number | null; response_ms: number | null }>
  const points = rows
    .map((r) => ({ checkedAt: r.checked_at, ok: r.ok, status: r.status, responseMs: r.response_ms }))
    .reverse()
  return { ok: true, data: points }
}
