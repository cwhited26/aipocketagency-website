// enqueue.test.ts — the webhook/activation/usage enqueuers compose the right rows with the right
// send-at offsets and honor their idempotency / dedup guards. The DB layer is mocked.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  enqueueMany: vi.fn(),
  enqueueEmail: vi.fn(),
  recordTriggerFired: vi.fn(),
  countRecentByTemplate: vi.fn(),
  resolveOwnerContact: vi.fn(),
  cancelPendingTriggersForOwner: vi.fn(),
}));

vi.mock("../queue", () => ({
  enqueueMany: h.enqueueMany,
  enqueueEmail: h.enqueueEmail,
  recordTriggerFired: h.recordTriggerFired,
  countRecentByTemplate: h.countRecentByTemplate,
  resolveOwnerContact: h.resolveOwnerContact,
  cancelPendingTriggersForOwner: h.cancelPendingTriggersForOwner,
}));

import {
  enqueueOnboarding,
  enqueuePilot,
  enqueueTriggerEmail,
  enqueueUsageCapEmail,
} from "../enqueue";

const WHO = { ownerId: "u1", email: "owner@example.com", firstName: "Sam" };
const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  h.enqueueMany.mockResolvedValue({ ok: true, data: [] });
  h.enqueueEmail.mockResolvedValue({ ok: true, data: "id1" });
  h.recordTriggerFired.mockResolvedValue({ ok: true, data: true });
  h.countRecentByTemplate.mockResolvedValue({ ok: true, data: 0 });
});

describe("enqueueOnboarding", () => {
  it("enqueues the plan welcome (immediate) + the 12 universal steps with correct offsets", async () => {
    await enqueueOnboarding(WHO, "pro", NOW);
    expect(h.enqueueMany).toHaveBeenCalledOnce();
    const inputs = h.enqueueMany.mock.calls[0][0] as Array<{ templateSlug: string; sendAt: string }>;
    expect(inputs).toHaveLength(13);
    expect(inputs[0].templateSlug).toBe("plan-specific.business-agent-welcome");
    expect(Date.parse(inputs[0].sendAt)).toBe(NOW);
    expect(inputs[1].templateSlug).toBe("onboarding.day-0-purchase-confirmation");
    const day3 = inputs.find((i) => i.templateSlug === "onboarding.day-3-workflow");
    expect(day3 && Date.parse(day3.sendAt)).toBe(NOW + 3 * DAY_MS);
  });
});

describe("enqueuePilot", () => {
  it("enqueues 18 pilot rows", async () => {
    await enqueuePilot(WHO, NOW);
    const inputs = h.enqueueMany.mock.calls[0][0] as unknown[];
    expect(inputs).toHaveLength(18);
  });
});

describe("enqueueTriggerEmail", () => {
  it("sends once when the trigger has not fired", async () => {
    h.recordTriggerFired.mockResolvedValue({ ok: true, data: true });
    const r = await enqueueTriggerEmail(WHO, "triggers.bb-no-persona", NOW);
    expect(r).toEqual({ ok: true, count: 1 });
    expect(h.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("is a no-op when the trigger already fired (idempotent)", async () => {
    h.recordTriggerFired.mockResolvedValue({ ok: true, data: false });
    const r = await enqueueTriggerEmail(WHO, "triggers.bb-no-persona", NOW);
    expect(r).toEqual({ ok: true, count: 0 });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("enqueueUsageCapEmail", () => {
  it("enqueues when not sent in the window", async () => {
    h.countRecentByTemplate.mockResolvedValue({ ok: true, data: 0 });
    const r = await enqueueUsageCapEmail(WHO, "leads", NOW);
    expect(r).toEqual({ ok: true, count: 1 });
    expect(h.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("dedups within 30 days (no second send)", async () => {
    h.countRecentByTemplate.mockResolvedValue({ ok: true, data: 1 });
    const r = await enqueueUsageCapEmail(WHO, "leads", NOW);
    expect(r).toEqual({ ok: true, count: 0 });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("is a no-op for an unknown metric", async () => {
    const r = await enqueueUsageCapEmail(WHO, "not_a_metric", NOW);
    expect(r).toEqual({ ok: true, count: 0 });
  });
});
