// refund.ts — Pocket Capture standalone refund policy (PC-MARK-2, SPEC PC-Q8).
//
// 30 days money-back, no questions asked — the consumer-impulse-buy norm for a $47 one-time product.
// The window runs from the moment payment cleared (the Stripe charge), not from account creation, so a
// buyer who never sets anything up is still inside the same 30 days. Pure date math, no imports — the
// boundary is unit-tested directly. The customer-facing statement of this policy lives on /capture/terms.

import { POCKET_CAPTURE_REFUND_WINDOW_DAYS } from "./product";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The last instant a refund can be requested: exactly N days after payment cleared. */
export function refundDeadline(paymentAt: Date): Date {
  return new Date(paymentAt.getTime() + POCKET_CAPTURE_REFUND_WINDOW_DAYS * MS_PER_DAY);
}

/**
 * Whether `now` is still within the 30-day money-back window measured from `paymentAt`.
 * The deadline instant itself counts as inside the window (<=), so a request at the exact boundary
 * is honored. Returns false for an invalid date so a bad input never silently grants a refund.
 */
export function isWithinRefundWindow(paymentAt: Date, now: Date): boolean {
  const paid = paymentAt.getTime();
  const at = now.getTime();
  if (!Number.isFinite(paid) || !Number.isFinite(at)) return false;
  return at <= refundDeadline(paymentAt).getTime();
}

/** Whole days left in the refund window (never negative); 0 once the window has closed. */
export function refundDaysRemaining(paymentAt: Date, now: Date): number {
  const remainingMs = refundDeadline(paymentAt).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / MS_PER_DAY);
}
