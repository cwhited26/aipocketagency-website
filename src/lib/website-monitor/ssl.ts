// ssl.ts — SSL certificate expiry detection (pure logic, unit-tested in isolation).
//
// The poller reads a cert's notAfter date off the TLS socket; this module turns that date plus the
// owner's threshold into a yes/no "expiring soon" decision and the day count for the alert copy.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole days from `now` until `expiresAt` (negative when the cert has already expired). Rounds DOWN
 * so a cert with 13.9 days left reports 13 — the conservative read for a "< N days" alert.
 */
export function daysUntilExpiry(expiresAt: Date, now: Date): number {
  return Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY)
}

/**
 * Should an SSL-expiry alert fire?
 *   • thresholdDays <= 0 disables the check (the owner turned it off).
 *   • a missing / unparseable expiry never fires (we only alert on a cert we actually read).
 *   • an already-expired cert (days < 0) always fires when the check is on — that's the worst case.
 *   • otherwise fire when the remaining whole days are strictly below the threshold.
 */
export function isSslExpiringSoon(
  expiresAt: Date | null,
  now: Date,
  thresholdDays: number,
): boolean {
  if (thresholdDays <= 0) return false
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false
  return daysUntilExpiry(expiresAt, now) < thresholdDays
}

/** Human day-count phrase for the alert card: "expired 2 days ago" / "expires in 9 days" / "expires today". */
export function expiryPhrase(expiresAt: Date, now: Date): string {
  const days = daysUntilExpiry(expiresAt, now)
  if (days < 0) return `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
  if (days === 0) return "expires today"
  return `expires in ${days} day${days === 1 ? "" : "s"}`
}
