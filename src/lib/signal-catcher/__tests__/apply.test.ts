// Unit tests for the Signal Catcher approve path (lib/signal-catcher/apply approveSignalProposal)
// — the contract the whole feature hangs on: approving a proposal card creates a REAL ritual
// through the shipped Scheduler (createRitual with the parser's cron + the verbatim cadence text),
// enforces the PA-RITUAL-8 active cap with the Scheduler's own reason copy, honors inline owner
// edits, refuses a malformed payload at the Zod boundary, and flips the catch row. The rituals
// data layer + the catch data layer are mocked; the parser, target resolver, and cap logic run
// for real (they're pure).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rituals/db", () => ({
  countActiveRituals: vi.fn(),
  createRitual: vi.fn(),
}));
vi.mock("../db", () => ({
  resolveSignalCatch: vi.fn(async () => ({ ok: true, data: null })),
  fetchSignalCatchById: vi.fn(),
}));

import { countActiveRituals, createRitual } from "@/lib/rituals/db";
import { resolveSignalCatch } from "../db";
import { approveSignalProposal, rejectSignalProposal } from "../apply";

const CATCH_ID = "3b6f0a52-8c1d-4c7e-9d2a-5f4e6a7b8c9d";

function payload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    signalCatchId: CATCH_ID,
    quote: "I keep meaning to check my pipeline every Monday",
    ritualName: "Monday Pipeline Review",
    cadenceText: "every Monday at 8am",
    cadenceSummary: "Every Monday at 8:00 AM",
    appSlug: "lead-scout",
    appLabel: "Lead Scout",
    signalType: "recurring_task",
    confidence: 0.86,
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(countActiveRituals).mockResolvedValue({ ok: true, data: 3 });
  vi.mocked(createRitual).mockResolvedValue({
    ok: true,
    data: { id: "ritual-1" } as never,
  });
  vi.mocked(resolveSignalCatch).mockClear();
  vi.mocked(createRitual).mockClear();
});

describe("approveSignalProposal", () => {
  it("creates a real ritual through the shipped Scheduler with the parsed cron", async () => {
    const got = await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: payload(),
      overrides: {},
    });
    expect(got).toEqual({ ok: true, ritualId: "ritual-1" });
    expect(createRitual).toHaveBeenCalledTimes(1);
    const params = vi.mocked(createRitual).mock.calls[0][0];
    expect(params.ownerId).toBe("o1");
    expect(params.name).toBe("Monday Pipeline Review");
    expect(params.appSlug).toBe("lead-scout");
    expect(params.scheduleCron).toBe("0 8 * * 1"); // "every Monday at 8am" through the real parser
    expect(params.scheduleNaturalText).toBe("every Monday at 8am");
    expect(params.delivery).toBe("inbox");
    expect(params.projectPlanId).toBeNull();
    expect(new Date(params.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("flips the catch row to approved with the new ritual id", async () => {
    await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: payload(),
      overrides: {},
    });
    expect(resolveSignalCatch).toHaveBeenCalledWith(CATCH_ID, "o1", {
      status: "approved",
      ritualId: "ritual-1",
    });
  });

  it("honors inline owner edits to the name and cadence", async () => {
    await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: payload(),
      overrides: { ritualName: "Pipeline Check", ritualCadence: "weekdays at 9am" },
    });
    const params = vi.mocked(createRitual).mock.calls[0][0];
    expect(params.name).toBe("Pipeline Check");
    expect(params.scheduleCron).toBe("0 9 * * 1-5");
    expect(params.scheduleNaturalText).toBe("weekdays at 9am");
  });

  it("enforces the PA-RITUAL-8 active cap with the Scheduler's reason, creating nothing", async () => {
    vi.mocked(countActiveRituals).mockResolvedValue({ ok: true, data: 1 });
    const got = await approveSignalProposal({
      ownerId: "o1",
      tier: "starter", // cap 1, already holding 1
      payload: payload(),
      overrides: {},
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.status).toBe(403);
      expect(got.error).toContain("Your plan runs 1 ritual at a time");
    }
    expect(createRitual).not.toHaveBeenCalled();
  });

  it("bounces an unparseable owner-edited cadence with the parser's reason", async () => {
    const got = await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: payload(),
      overrides: { ritualCadence: "whenever mercury is in retrograde" },
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.status).toBe(422);
    expect(createRitual).not.toHaveBeenCalled();
  });

  it("refuses a malformed payload at the Zod boundary", async () => {
    const got = await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: { signalCatchId: "not-a-uuid" },
      overrides: {},
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.status).toBe(422);
    expect(createRitual).not.toHaveBeenCalled();
  });

  it("refuses when the App the proposal targeted no longer resolves", async () => {
    const got = await approveSignalProposal({
      ownerId: "o1",
      tier: "studio_plus",
      payload: payload({ appSlug: "an-app-that-never-existed" }),
      overrides: {},
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.status).toBe(422);
    expect(createRitual).not.toHaveBeenCalled();
  });
});

describe("rejectSignalProposal", () => {
  it("flips the catch row to rejected — the 30-day window's source of truth", async () => {
    await rejectSignalProposal({ ownerId: "o1", payload: payload() });
    expect(resolveSignalCatch).toHaveBeenCalledWith(CATCH_ID, "o1", { status: "rejected" });
  });

  it("does nothing on a malformed payload (no throw, no flip)", async () => {
    await rejectSignalProposal({ ownerId: "o1", payload: { nope: true } });
    expect(resolveSignalCatch).not.toHaveBeenCalled();
  });
});
