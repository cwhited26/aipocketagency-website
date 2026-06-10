// sweep.test.ts — the queue drain: it skips unsubscribed marketing mail, sends transactional mail even
// when unsubscribed, records sends, and applies backoff + the attempts cap on failure. The DB layer and
// Resend transport are mocked — no network.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  listDueEmails: vi.fn(),
  isUnsubscribed: vi.fn(),
  markEmailSent: vi.fn(),
  markEmailFailure: vi.fn(),
  markEmailCancelled: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("../queue", () => ({
  listDueEmails: h.listDueEmails,
  isUnsubscribed: h.isUnsubscribed,
  markEmailSent: h.markEmailSent,
  markEmailFailure: h.markEmailFailure,
  markEmailCancelled: h.markEmailCancelled,
}));
vi.mock("@/lib/resend", () => ({ sendEmail: h.sendEmail }));

import { sweepEmailQueue } from "../sweep";

type Row = {
  id: string;
  email: string;
  template_slug: string;
  template_props: Record<string, unknown>;
  attempts: number;
};

function row(over: Partial<Row>): Row {
  return {
    id: "r1",
    email: "owner@example.com",
    template_slug: "onboarding.day-3-workflow",
    template_props: { email: "owner@example.com" },
    attempts: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isUnsubscribed.mockResolvedValue({ ok: true, data: false });
  h.markEmailSent.mockResolvedValue({ ok: true, data: null });
  h.markEmailFailure.mockResolvedValue({ ok: true, data: null });
  h.markEmailCancelled.mockResolvedValue({ ok: true, data: null });
  h.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
});

describe("sweepEmailQueue", () => {
  it("skips marketing mail for an unsubscribed recipient (cancels, no send)", async () => {
    h.listDueEmails.mockResolvedValue({ ok: true, data: [row({})] });
    h.isUnsubscribed.mockResolvedValue({ ok: true, data: true });

    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.skipped).toBe(1);
    expect(h.markEmailCancelled).toHaveBeenCalledWith("r1", "unsubscribed");
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("sends transactional mail even when unsubscribed (bypass)", async () => {
    h.listDueEmails.mockResolvedValue({
      ok: true,
      data: [row({ template_slug: "onboarding.day-0-purchase-confirmation" })],
    });
    h.isUnsubscribed.mockResolvedValue({ ok: true, data: true });

    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.sent).toBe(1);
    expect(h.isUnsubscribed).not.toHaveBeenCalled(); // transactional short-circuits the check
    expect(h.markEmailSent).toHaveBeenCalled();
  });

  it("marks sent on a successful send", async () => {
    h.listDueEmails.mockResolvedValue({ ok: true, data: [row({})] });
    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.sent).toBe(1);
    expect(h.sendEmail).toHaveBeenCalledOnce();
  });

  it("retries with backoff on failure below the cap (stays pending)", async () => {
    h.listDueEmails.mockResolvedValue({ ok: true, data: [row({ attempts: 0 })] });
    h.sendEmail.mockResolvedValue({ ok: false, status: 500, error: "boom" });

    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.skipped).toBe(1); // not yet failed → counted as skipped (will retry)
    expect(h.markEmailFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", attempts: 1, maxAttempts: 5 }),
    );
  });

  it("hits the attempts cap → failed", async () => {
    h.listDueEmails.mockResolvedValue({ ok: true, data: [row({ attempts: 4 })] });
    h.sendEmail.mockResolvedValue({ ok: false, status: 500, error: "boom" });

    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.failed).toBe(1);
    expect(h.markEmailFailure).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 5, maxAttempts: 5 }),
    );
  });

  it("fails an unknown template slug permanently", async () => {
    h.listDueEmails.mockResolvedValue({ ok: true, data: [row({ template_slug: "bogus.slug" })] });
    const r = await sweepEmailQueue(100, 1_000_000);
    expect(r.ok && r.data.failed).toBe(1);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
});
