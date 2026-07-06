// Slot scheduling + the lobby lock (PA-POS-38 §24.4). Pure time math.

import { describe, expect, it } from "vitest";
import {
  LOBBY_OPEN_MINUTES,
  SLOT_LOCAL_HOURS,
  canServeVideo,
  isValidSlot,
  lobbyPhase,
  safeTimeZone,
  upcomingSlots,
} from "../slots";
import { computeWorkshopSchedule } from "@/lib/emails/sequences";

const MIN = 60_000;

describe("upcomingSlots", () => {
  it("auto-populates three slots a day for the next seven days, all in the future", () => {
    const now = Date.UTC(2026, 6, 5, 12, 0, 0);
    const slots = upcomingSlots(now, "America/Chicago");
    expect(slots.length).toBe(7 * SLOT_LOCAL_HOURS.length);
    for (const s of slots) {
      expect(s.epochMs).toBeGreaterThan(now);
      expect(isValidSlot(s.iso, now)).toBe(true);
    }
    // Ascending.
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.epochMs).toBeGreaterThan(slots[i - 1]!.epochMs);
    }
  });

  it("lands slots at the advertised local hours in the attendee's timezone", () => {
    const now = Date.UTC(2026, 6, 5, 3, 0, 0);
    const slots = upcomingSlots(now, "America/New_York");
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    });
    for (const s of slots) {
      const hour = Number(fmt.format(s.epochMs));
      expect(SLOT_LOCAL_HOURS).toContain(hour);
    }
  });

  it("falls back to UTC on a junk timezone", () => {
    expect(safeTimeZone("Not/AZone")).toBe("UTC");
    const now = Date.UTC(2026, 6, 5, 0, 0, 0);
    expect(upcomingSlots(now, "Not/AZone").length).toBeGreaterThan(0);
  });
});

describe("isValidSlot", () => {
  const now = Date.UTC(2026, 6, 5, 12, 0, 0);
  it("rejects the past, junk, and beyond the window", () => {
    expect(isValidSlot("garbage", now)).toBe(false);
    expect(isValidSlot(new Date(now - MIN).toISOString(), now)).toBe(false);
    expect(isValidSlot(new Date(now + 30 * 24 * 60 * MIN).toISOString(), now)).toBe(false);
    expect(isValidSlot(new Date(now + 60 * MIN).toISOString(), now)).toBe(true);
  });
});

describe("lobby lock (§24.4: T-15)", () => {
  const slot = Date.UTC(2026, 6, 6, 14, 0, 0);
  it("is locked before T-15 and open from T-15 to T-0", () => {
    expect(lobbyPhase(slot, slot - (LOBBY_OPEN_MINUTES + 1) * MIN)).toBe("locked");
    expect(lobbyPhase(slot, slot - LOBBY_OPEN_MINUTES * MIN)).toBe("open");
    expect(lobbyPhase(slot, slot - 1 * MIN)).toBe("open");
    expect(lobbyPhase(slot, slot)).toBe("live");
  });

  it("serves video only from the slot through the grace window", () => {
    expect(canServeVideo(slot, slot - 20 * MIN)).toBe(false);
    expect(canServeVideo(slot, slot - 1 * MIN)).toBe(false);
    expect(canServeVideo(slot, slot + 30 * MIN)).toBe(true);
    expect(canServeVideo(slot, slot + 7 * 60 * MIN)).toBe(false);
  });
});

describe("pre-session email schedule", () => {
  it("anchors the 4 emails to the slot and drops stale reminders for late bookers", () => {
    const now = Date.UTC(2026, 6, 5, 12, 0, 0);
    const slot = now + 3 * 24 * 60 * MIN;
    const full = computeWorkshopSchedule(slot, now);
    expect(full.map((s) => s.slug)).toEqual([
      "workshop.purchase-confirmation",
      "workshop.reminder-24h",
      "workshop.reminder-1h",
      "workshop.lobby-open",
    ]);
    expect(Date.parse(full[3]!.sendAt)).toBe(slot - 15 * MIN);

    // Booked 40 minutes out: the T-24h and T-1h reminders are already past — dropped.
    const late = computeWorkshopSchedule(now + 40 * MIN, now);
    expect(late.map((s) => s.slug)).toEqual([
      "workshop.purchase-confirmation",
      "workshop.lobby-open",
    ]);
  });
});
