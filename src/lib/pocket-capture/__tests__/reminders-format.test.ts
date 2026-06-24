import { describe, expect, it } from "vitest";
import {
  humanizeDuration,
  formatAbsoluteUtc,
  confirmationMessage,
  reminderMessage,
  reminderErrorMessage,
} from "../reminders/format";

describe("humanizeDuration", () => {
  it("renders minutes", () => expect(humanizeDuration(39 * 60_000)).toBe("39 min"));
  it("renders a single hour", () => expect(humanizeDuration(60 * 60_000)).toBe("1 hour"));
  it("renders hours", () => expect(humanizeDuration(5 * 3600_000)).toBe("5 hours"));
  it("renders a single day at the 24-hour boundary", () => expect(humanizeDuration(24 * 3600_000)).toBe("1 day"));
  it("renders multiple days", () => expect(humanizeDuration(3 * 24 * 3600_000)).toBe("3 days"));
  it("clamps a negative span to 0 min", () => expect(humanizeDuration(-5000)).toBe("0 min"));
});

describe("formatAbsoluteUtc", () => {
  it("formats in UTC with a UTC suffix", () => {
    const s = formatAbsoluteUtc(new Date("2026-06-24T09:00:00.000Z"));
    expect(s).toContain("UTC");
    expect(s).toContain("Jun 24");
    expect(s).toContain("9:00");
  });
});

describe("confirmationMessage (PC-Q10)", () => {
  it("confirms the task, absolute time, and relative offset", () => {
    const now = new Date("2026-06-23T12:00:00.000Z");
    const remindAt = new Date(now.getTime() + 39 * 60_000);
    const msg = confirmationMessage("call the dentist", remindAt, now);
    expect(msg).toContain("Got it.");
    expect(msg).toContain("call the dentist");
    expect(msg).toContain("in 39 min");
    expect(msg).toContain("UTC");
  });
});

describe("reminderMessage", () => {
  it("leads with Reminder: and notes how long ago it was set", () => {
    const created = new Date("2026-06-23T12:00:00.000Z");
    const now = new Date(created.getTime() + 39 * 60_000);
    const msg = reminderMessage("call the dentist", created, now);
    expect(msg).toBe("Reminder: call the dentist (you set this 39 min ago).");
  });
});

describe("reminderErrorMessage", () => {
  it("calls out the 90-day cap specifically", () => {
    expect(reminderErrorMessage("horizon-exceeded")).toContain("90 days");
  });
  it("explains it couldn't tell when, and saved a note", () => {
    const msg = reminderErrorMessage("no-time");
    expect(msg.toLowerCase()).toContain("couldn't tell when");
    expect(msg.toLowerCase()).toContain("note");
  });
});
