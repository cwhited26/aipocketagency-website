import { describe, it, expect } from "vitest"
import { daysUntilExpiry, expiryPhrase, isSslExpiringSoon } from "../ssl"

const now = new Date("2026-06-30T12:00:00.000Z")

function inDays(n: number): Date {
  return new Date(now.getTime() + n * 24 * 60 * 60 * 1000)
}

describe("daysUntilExpiry", () => {
  it("counts whole days, rounding down", () => {
    expect(daysUntilExpiry(inDays(10), now)).toBe(10)
    // 13.9 days → 13 (the conservative read)
    expect(daysUntilExpiry(new Date(now.getTime() + 13.9 * 86400000), now)).toBe(13)
  })

  it("is negative for an already-expired cert", () => {
    expect(daysUntilExpiry(inDays(-2), now)).toBe(-2)
  })
})

describe("isSslExpiringSoon", () => {
  it("fires when remaining days are strictly below the threshold", () => {
    expect(isSslExpiringSoon(inDays(13), now, 14)).toBe(true)
  })

  it("does not fire when remaining days equal or exceed the threshold", () => {
    expect(isSslExpiringSoon(inDays(14), now, 14)).toBe(false)
    expect(isSslExpiringSoon(inDays(30), now, 14)).toBe(false)
  })

  it("always fires for an already-expired cert when the check is on", () => {
    expect(isSslExpiringSoon(inDays(-1), now, 14)).toBe(true)
  })

  it("is disabled when threshold is 0", () => {
    expect(isSslExpiringSoon(inDays(1), now, 0)).toBe(false)
    expect(isSslExpiringSoon(inDays(-5), now, 0)).toBe(false)
  })

  it("never fires on a missing or unparseable expiry", () => {
    expect(isSslExpiringSoon(null, now, 14)).toBe(false)
    expect(isSslExpiringSoon(new Date("not-a-date"), now, 14)).toBe(false)
  })
})

describe("expiryPhrase", () => {
  it("describes future, today, and past expiries", () => {
    expect(expiryPhrase(inDays(9), now)).toBe("expires in 9 days")
    expect(expiryPhrase(inDays(1), now)).toBe("expires in 1 day")
    expect(expiryPhrase(inDays(0.2), now)).toBe("expires today")
    expect(expiryPhrase(inDays(-2), now)).toBe("expired 2 days ago")
    expect(expiryPhrase(inDays(-1), now)).toBe("expired 1 day ago")
  })
})
