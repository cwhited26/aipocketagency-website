import { describe, it, expect } from "vitest"
import { detectAlerts, isUpStatus } from "../diff"
import type { CheckResult, MonitoredWebsite } from "../types"

const now = new Date("2026-06-30T12:00:00.000Z")

function site(overrides: Partial<MonitoredWebsite> = {}): MonitoredWebsite {
  return {
    id: "w1",
    ownerId: "o1",
    url: "https://example.com",
    checkIntervalSeconds: 900,
    alertOnStatusChange: true,
    alertOnContentChange: false,
    alertOnSlowResponse: true,
    alertOnSslExpiryDays: 14,
    lastCheckAt: "2026-06-30T11:00:00.000Z",
    lastStatus: 200,
    lastResponseMs: 120,
    lastContentHash: "hash-a",
    lastSslExpiresAt: null,
    isActive: true,
    ...overrides,
  }
}

function result(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    ok: true,
    status: 200,
    responseMs: 150,
    contentHash: "hash-a",
    sslExpiresAt: null,
    error: null,
    ...overrides,
  }
}

describe("isUpStatus", () => {
  it("treats 2xx/3xx as up, everything else as down", () => {
    expect(isUpStatus(200)).toBe(true)
    expect(isUpStatus(301)).toBe(true)
    expect(isUpStatus(404)).toBe(false)
    expect(isUpStatus(503)).toBe(false)
    expect(isUpStatus(null)).toBe(false)
  })
})

describe("detectAlerts — status change", () => {
  it("fires when an up site goes down", () => {
    const alerts = detectAlerts(site({ lastStatus: 200 }), result({ ok: false, status: 503 }), now)
    expect(alerts.map((a) => a.kind)).toContain("status_change")
  })

  it("fires on recovery (down → up)", () => {
    const alerts = detectAlerts(site({ lastStatus: 500 }), result({ status: 200 }), now)
    expect(alerts.map((a) => a.kind)).toContain("status_change")
  })

  it("does not fire when the up/down class is unchanged", () => {
    const alerts = detectAlerts(site({ lastStatus: 200 }), result({ status: 204 }), now)
    expect(alerts.map((a) => a.kind)).not.toContain("status_change")
  })

  it("never fires without a baseline (first ever check)", () => {
    const alerts = detectAlerts(
      site({ lastStatus: null, lastCheckAt: null, alertOnSlowResponse: false }),
      result({ ok: false, status: 500 }),
      now,
    )
    expect(alerts.map((a) => a.kind)).not.toContain("status_change")
  })

  it("respects the toggle being off", () => {
    const alerts = detectAlerts(
      site({ lastStatus: 200, alertOnStatusChange: false, alertOnSlowResponse: false }),
      result({ ok: false, status: 500 }),
      now,
    )
    expect(alerts).toHaveLength(0)
  })

  it("treats a transport error (status null) as down", () => {
    const alerts = detectAlerts(
      site({ lastStatus: 200, alertOnSlowResponse: false }),
      result({ ok: false, status: null, error: "ECONNREFUSED", contentHash: null }),
      now,
    )
    expect(alerts.map((a) => a.kind)).toContain("status_change")
  })
})

describe("detectAlerts — slow response", () => {
  it("fires above 3s on an ok response, even on the first check", () => {
    const alerts = detectAlerts(
      site({ lastStatus: null, lastCheckAt: null, alertOnStatusChange: false }),
      result({ responseMs: 4200 }),
      now,
    )
    expect(alerts.map((a) => a.kind)).toContain("slow_response")
  })

  it("does not fire when the response is not ok", () => {
    const alerts = detectAlerts(
      site({ alertOnStatusChange: false }),
      result({ ok: false, status: 500, responseMs: 9000 }),
      now,
    )
    expect(alerts.map((a) => a.kind)).not.toContain("slow_response")
  })

  it("respects the toggle", () => {
    const alerts = detectAlerts(site({ alertOnSlowResponse: false }), result({ responseMs: 8000 }), now)
    expect(alerts.map((a) => a.kind)).not.toContain("slow_response")
  })
})

describe("detectAlerts — content change", () => {
  it("fires when the hash drifts and the URL is opted in", () => {
    const alerts = detectAlerts(
      site({ alertOnContentChange: true, lastContentHash: "hash-a", alertOnSlowResponse: false }),
      result({ contentHash: "hash-b" }),
      now,
    )
    expect(alerts.map((a) => a.kind)).toContain("content_change")
  })

  it("does not fire without a baseline hash", () => {
    const alerts = detectAlerts(
      site({ alertOnContentChange: true, lastContentHash: null, alertOnSlowResponse: false }),
      result({ contentHash: "hash-b" }),
      now,
    )
    expect(alerts.map((a) => a.kind)).not.toContain("content_change")
  })

  it("is off by default (opt-in only)", () => {
    const alerts = detectAlerts(
      site({ alertOnContentChange: false, lastContentHash: "hash-a", alertOnSlowResponse: false }),
      result({ contentHash: "hash-b" }),
      now,
    )
    expect(alerts.map((a) => a.kind)).not.toContain("content_change")
  })
})

describe("detectAlerts — SSL expiry", () => {
  it("fires when the cert expires inside the threshold", () => {
    const soon = new Date(now.getTime() + 10 * 86400000).toISOString()
    const alerts = detectAlerts(
      site({ alertOnStatusChange: false, alertOnSlowResponse: false, alertOnSslExpiryDays: 14 }),
      result({ sslExpiresAt: soon }),
      now,
    )
    expect(alerts.map((a) => a.kind)).toContain("ssl_expiry")
  })

  it("does not fire for a healthy cert", () => {
    const far = new Date(now.getTime() + 90 * 86400000).toISOString()
    const alerts = detectAlerts(
      site({ alertOnStatusChange: false, alertOnSlowResponse: false }),
      result({ sslExpiresAt: far }),
      now,
    )
    expect(alerts.map((a) => a.kind)).not.toContain("ssl_expiry")
  })

  it("combines multiple alerts in one check", () => {
    const soon = new Date(now.getTime() + 3 * 86400000).toISOString()
    const alerts = detectAlerts(
      site({ lastStatus: 200, alertOnContentChange: true, lastContentHash: "hash-a", alertOnSslExpiryDays: 14 }),
      result({ ok: false, status: 500, responseMs: 5000, contentHash: "hash-b", sslExpiresAt: soon }),
      now,
    )
    // down (status), content drift, ssl — slow_response won't fire because ok is false.
    expect(alerts.map((a) => a.kind).sort()).toEqual(["content_change", "ssl_expiry", "status_change"])
  })
})
