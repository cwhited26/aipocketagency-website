import { describe, expect, it } from "vitest";
import {
  matchesReminderPattern,
  validateRemindAt,
  parseReminderRequest,
  isUserFixable,
  MAX_HORIZON_DAYS,
  type ReminderExtractor,
} from "../reminders/parse";

const NOW = new Date("2026-06-23T12:00:00.000Z");

// A canned extractor so the full pipeline (phrasing → validation) is tested without the network.
function fakeExtractor(extraction: {
  isReminder: boolean;
  task: string | null;
  remindAtIso: string | null;
  confidence: number;
} | null): ReminderExtractor {
  return async () => extraction;
}

describe("matchesReminderPattern — the pre-filter", () => {
  it.each([
    "remind me to call the dentist in 39 min",
    "Remind me to send the proposal tomorrow at 9am",
    "set a reminder to do taxes Thursday 3pm",
    "set an reminder to stretch",
    "remember to water the plants next Monday",
    "please remind me about the meeting",
    "don't let me forget to renew the domain",
    "ping me in 2 hours",
    "nudge me tomorrow",
  ])("matches reminder phrasing: %s", (text) => {
    expect(matchesReminderPattern(text)).toBe(true);
  });

  it.each([
    "Check out this article https://example.com/post",
    "Buy milk and eggs",
    "I'll remind him later about the deck",
    "this is a reminder of how far we've come",
    "great meeting notes from today",
  ])("does not match ordinary capture text: %s", (text) => {
    expect(matchesReminderPattern(text)).toBe(false);
  });
});

describe("validateRemindAt — 90-day cap + past guard (pure)", () => {
  it("accepts a near-future time", () => {
    const r = validateRemindAt(new Date(NOW.getTime() + 39 * 60_000), NOW);
    expect(r.ok).toBe(true);
  });

  it("accepts a time right at the 90-day horizon", () => {
    const r = validateRemindAt(new Date(NOW.getTime() + MAX_HORIZON_DAYS * 24 * 3600_000 - 1000), NOW);
    expect(r.ok).toBe(true);
  });

  it("rejects a time beyond 90 days as horizon-exceeded", () => {
    const r = validateRemindAt(new Date(NOW.getTime() + (MAX_HORIZON_DAYS + 1) * 24 * 3600_000), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("horizon-exceeded");
  });

  it("rejects a time in the past beyond the grace window", () => {
    const r = validateRemindAt(new Date(NOW.getTime() - 5 * 60_000), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("past-time");
  });

  it("tolerates a few seconds of clock skew (grace window)", () => {
    const r = validateRemindAt(new Date(NOW.getTime() - 10_000), NOW);
    expect(r.ok).toBe(true);
  });
});

describe("parseReminderRequest — end to end with an injected extractor", () => {
  it("returns not-a-reminder for text the pre-filter rejects (no model call)", async () => {
    let called = false;
    const extract: ReminderExtractor = async () => {
      called = true;
      return null;
    };
    const r = await parseReminderRequest({ text: "buy milk", now: NOW, apiKey: "k", extract });
    expect(r.isReminder).toBe(false);
    expect(called).toBe(false);
  });

  it("schedules a confident reminder", async () => {
    const remindAtIso = new Date(NOW.getTime() + 39 * 60_000).toISOString();
    const r = await parseReminderRequest({
      text: "remind me to call the dentist in 39 min",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor({ isReminder: true, task: "call the dentist", remindAtIso, confidence: 0.95 }),
    });
    expect(r.isReminder).toBe(true);
    if (r.isReminder && r.ok) {
      expect(r.taskText).toBe("call the dentist");
      expect(r.remindAt.toISOString()).toBe(remindAtIso);
    }
  });

  it("enforces the 90-day cap end to end", async () => {
    const remindAtIso = new Date(NOW.getTime() + 120 * 24 * 3600_000).toISOString();
    const r = await parseReminderRequest({
      text: "remind me to renew in 4 months",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor({ isReminder: true, task: "renew", remindAtIso, confidence: 0.9 }),
    });
    expect(r).toMatchObject({ isReminder: true, ok: false, reason: "horizon-exceeded" });
  });

  it("flags low confidence as user-fixable", async () => {
    const r = await parseReminderRequest({
      text: "remind me about the thing sometime",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor({
        isReminder: true,
        task: "the thing",
        remindAtIso: new Date(NOW.getTime() + 3600_000).toISOString(),
        confidence: 0.2,
      }),
    });
    expect(r).toMatchObject({ isReminder: true, ok: false, reason: "low-confidence" });
    if (r.isReminder && !r.ok) expect(isUserFixable(r.reason)).toBe(true);
  });

  it("flags no extractable time as no-time", async () => {
    const r = await parseReminderRequest({
      text: "remind me to call mom",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor({ isReminder: true, task: "call mom", remindAtIso: null, confidence: 0.9 }),
    });
    expect(r).toMatchObject({ isReminder: true, ok: false, reason: "no-time" });
  });

  it("treats a model 'not a reminder' verdict as a capture", async () => {
    const r = await parseReminderRequest({
      text: "remind me why we started this",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor({ isReminder: false, task: null, remindAtIso: null, confidence: 0.1 }),
    });
    expect(r.isReminder).toBe(false);
  });

  it("returns llm-unavailable (infra, not user-fixable) when the owner has no key", async () => {
    const r = await parseReminderRequest({
      text: "remind me to call the dentist in 39 min",
      now: NOW,
      apiKey: null,
    });
    expect(r).toMatchObject({ isReminder: true, ok: false, reason: "llm-unavailable" });
    if (r.isReminder && !r.ok) expect(isUserFixable(r.reason)).toBe(false);
  });

  it("returns llm-error when the extractor fails", async () => {
    const r = await parseReminderRequest({
      text: "remind me to call the dentist in 39 min",
      now: NOW,
      apiKey: "k",
      extract: fakeExtractor(null),
    });
    expect(r).toMatchObject({ isReminder: true, ok: false, reason: "llm-error" });
    if (r.isReminder && !r.ok) expect(isUserFixable(r.reason)).toBe(false);
  });
});
