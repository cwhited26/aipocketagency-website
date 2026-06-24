// upgrade-pitch.ts — pure gating + dismissal logic for the "Upgrade to Pocket Agent" card shown in
// the Captures dashboard (PC-MARK-5, PA-CAPTURE-3).
//
// The card only goes to standalone-only buyers who've gotten enough value to want more: at OR after
// 30 total captures OR 14 days since signup (whichever hits first), AND they own Pocket Capture
// standalone AND have no active PA subscription (paid PA subscribers already get the agents — never
// pitch them). The threshold is server-evaluated; the "Not now" dismissal is a 7-day window tracked
// client-side in localStorage. Import-free so every branch is unit-tested without React or the DB.

export const UPGRADE_CAPTURE_THRESHOLD = 30;
export const UPGRADE_DAYS_THRESHOLD = 14;
export const UPGRADE_DISMISS_DAYS = 7;

// localStorage key for the "Not now" dismissal. Stored value is an ISO expiry timestamp.
export const UPGRADE_DISMISS_KEY = "pc_upgrade_pitch_dismissed_until";

// Where the CTA routes. The query param tags the funnel source so /pricing can frame the upgrade.
export const UPGRADE_PITCH_HREF = "/pricing?upgrade_from=pocket_capture";

const DAY_MS = 86_400_000;

/** Days elapsed from an ISO timestamp to `nowMs`, or null when the timestamp is unparseable. Pure. */
export function daysSince(iso: string, nowMs: number): number | null {
  const from = Date.parse(iso);
  if (Number.isNaN(from)) return null;
  return (nowMs - from) / DAY_MS;
}

/**
 * Has the buyer hit the value bar? 30 captures OR 14 days since signup, whichever first. An
 * unparseable signup date falls back to the capture count only (never blocks on bad data). Pure.
 */
export function meetsUpgradeThreshold(args: {
  captureCount: number;
  signupAt: string;
  nowMs: number;
}): boolean {
  if (args.captureCount >= UPGRADE_CAPTURE_THRESHOLD) return true;
  const days = daysSince(args.signupAt, args.nowMs);
  return days !== null && days >= UPGRADE_DAYS_THRESHOLD;
}

/**
 * The full server-side gate: show the upgrade pitch only to a standalone buyer with no active PA
 * subscription who has crossed the value threshold. Paid PA subscribers and non-buyers never see it.
 * Pure.
 */
export function shouldShowUpgradePitch(args: {
  isPocketCaptureUser: boolean;
  hasActivePaSubscription: boolean;
  captureCount: number;
  signupAt: string;
  nowMs: number;
}): boolean {
  if (!args.isPocketCaptureUser) return false;
  if (args.hasActivePaSubscription) return false;
  return meetsUpgradeThreshold(args);
}

/** ISO expiry 7 days out — what "Not now" writes to localStorage. Pure. */
export function dismissUntilIso(nowMs: number): string {
  return new Date(nowMs + UPGRADE_DISMISS_DAYS * DAY_MS).toISOString();
}

/** Whether a stored dismissal is still in effect (expiry in the future). Pure. */
export function isDismissalActive(raw: string | null, nowMs: number): boolean {
  if (!raw) return false;
  const until = Date.parse(raw);
  return !Number.isNaN(until) && until > nowMs;
}
