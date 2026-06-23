import { describe, it, expect } from "vitest";
import {
  isWithinRefundWindow,
  refundDaysRemaining,
  refundDeadline,
} from "../refund";
import { POCKET_CAPTURE_REFUND_WINDOW_DAYS } from "../product";

const DAY = 24 * 60 * 60 * 1000;
const paidAt = new Date("2026-06-23T12:00:00.000Z");

describe("Pocket Capture 30-day refund window", () => {
  it("is a 30-day policy", () => {
    expect(POCKET_CAPTURE_REFUND_WINDOW_DAYS).toBe(30);
  });

  it("sets the deadline exactly 30 days after payment cleared", () => {
    const deadline = refundDeadline(paidAt);
    expect(deadline.getTime()).toBe(paidAt.getTime() + 30 * DAY);
  });

  it("honors a request inside the window", () => {
    expect(isWithinRefundWindow(paidAt, new Date(paidAt.getTime() + 1 * DAY))).toBe(true);
    expect(isWithinRefundWindow(paidAt, new Date(paidAt.getTime() + 29 * DAY))).toBe(true);
  });

  it("honors a request at the exact 30-day boundary", () => {
    expect(isWithinRefundWindow(paidAt, new Date(paidAt.getTime() + 30 * DAY))).toBe(true);
  });

  it("rejects a request after the window closes", () => {
    expect(isWithinRefundWindow(paidAt, new Date(paidAt.getTime() + 30 * DAY + 1))).toBe(false);
    expect(isWithinRefundWindow(paidAt, new Date(paidAt.getTime() + 31 * DAY))).toBe(false);
  });

  it("never silently grants a refund on an invalid date", () => {
    expect(isWithinRefundWindow(new Date("not-a-date"), new Date(paidAt))).toBe(false);
    expect(isWithinRefundWindow(paidAt, new Date("not-a-date"))).toBe(false);
  });

  it("reports whole days remaining, clamped at zero once closed", () => {
    expect(refundDaysRemaining(paidAt, paidAt)).toBe(30);
    expect(refundDaysRemaining(paidAt, new Date(paidAt.getTime() + 29.5 * DAY))).toBe(1);
    expect(refundDaysRemaining(paidAt, new Date(paidAt.getTime() + 30 * DAY))).toBe(0);
    expect(refundDaysRemaining(paidAt, new Date(paidAt.getTime() + 40 * DAY))).toBe(0);
  });
});
