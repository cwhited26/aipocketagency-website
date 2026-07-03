// Unit tests for the Signal Catcher dedup windows (lib/signal-catcher/types evaluateSignalDedup)
// — the pure decision that keeps the catcher from spamming: an active ritual with the same name
// never re-proposes; the same theme in the same conversation stays quiet for 7 days; a rejected
// theme stays quiet for 30 days; a pending card blocks a duplicate outright. Plus the sensitivity
// → threshold map and the theme-key normalizer the windows key on.

import { describe, expect, it } from "vitest";
import {
  evaluateSignalDedup,
  REJECTED_WINDOW_DAYS,
  REPROPOSE_WINDOW_DAYS,
  SENSITIVITY_THRESHOLDS,
  themeKeyOf,
  type SignalCatch,
} from "../types";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY_MS).toISOString();
}

type Prior = Pick<SignalCatch, "theme_key" | "status" | "created_at" | "source_persona_chat_id">;

function prior(over: Partial<Prior> = {}): Prior {
  return {
    theme_key: "monday-pipeline-review",
    status: "rejected",
    created_at: daysAgo(1),
    source_persona_chat_id: "conv-1",
    ...over,
  };
}

const CANDIDATE = { themeKey: "monday-pipeline-review", conversationId: "conv-1" };

describe("themeKeyOf", () => {
  it("normalizes name variants to one key", () => {
    expect(themeKeyOf("Monday Pipeline Review")).toBe("monday-pipeline-review");
    expect(themeKeyOf("  monday   PIPELINE review! ")).toBe("monday-pipeline-review");
  });

  it("never returns an empty key", () => {
    expect(themeKeyOf("!!!")).toBe("signal");
  });
});

describe("sensitivity thresholds", () => {
  it("ships the locked map: low 0.85, medium 0.70, high 0.55", () => {
    expect(SENSITIVITY_THRESHOLDS).toEqual({ low: 0.85, medium: 0.7, high: 0.55 });
  });
});

describe("evaluateSignalDedup", () => {
  it("passes a fresh theme with no rituals and no history", () => {
    const got = evaluateSignalDedup({
      candidate: CANDIDATE,
      activeRitualNames: [],
      priorCatches: [],
      now: NOW,
    });
    expect(got).toEqual({ ok: true });
  });

  it("blocks when an active ritual already carries the same name (case/punct-insensitive)", () => {
    const got = evaluateSignalDedup({
      candidate: CANDIDATE,
      activeRitualNames: ["MONDAY pipeline Review"],
      priorCatches: [],
      now: NOW,
    });
    expect(got).toEqual({ ok: false, reason: "already_ritualized" });
  });

  it("blocks a theme whose earlier card is still pending, regardless of age or conversation", () => {
    const got = evaluateSignalDedup({
      candidate: { ...CANDIDATE, conversationId: "conv-other" },
      activeRitualNames: [],
      priorCatches: [prior({ status: "pending_review", created_at: daysAgo(20) })],
      now: NOW,
    });
    expect(got).toEqual({ ok: false, reason: "pending_review" });
  });

  it("blocks a re-propose from the same conversation inside 7 days", () => {
    const got = evaluateSignalDedup({
      candidate: CANDIDATE,
      activeRitualNames: [],
      priorCatches: [
        prior({ status: "approved", created_at: daysAgo(REPROPOSE_WINDOW_DAYS - 1) }),
      ],
      now: NOW,
    });
    expect(got).toEqual({ ok: false, reason: "recently_proposed" });
  });

  it("allows the same theme from a DIFFERENT conversation once it isn't pending or rejected", () => {
    const got = evaluateSignalDedup({
      candidate: { ...CANDIDATE, conversationId: "conv-2" },
      activeRitualNames: [],
      priorCatches: [prior({ status: "approved", created_at: daysAgo(2) })],
      now: NOW,
    });
    expect(got).toEqual({ ok: true });
  });

  it("allows a re-propose from the same conversation after the 7-day window", () => {
    const got = evaluateSignalDedup({
      candidate: CANDIDATE,
      activeRitualNames: [],
      priorCatches: [
        prior({ status: "approved", created_at: daysAgo(REPROPOSE_WINDOW_DAYS + 1) }),
      ],
      now: NOW,
    });
    expect(got).toEqual({ ok: true });
  });

  it("blocks a rejected theme inside 30 days — any conversation", () => {
    const got = evaluateSignalDedup({
      candidate: { ...CANDIDATE, conversationId: "conv-brand-new" },
      activeRitualNames: [],
      priorCatches: [
        prior({ status: "rejected", created_at: daysAgo(REJECTED_WINDOW_DAYS - 1), source_persona_chat_id: "conv-1" }),
      ],
      now: NOW,
    });
    expect(got).toEqual({ ok: false, reason: "recently_rejected" });
  });

  it("allows a rejected theme back after the 30-day window", () => {
    const got = evaluateSignalDedup({
      candidate: { ...CANDIDATE, conversationId: "conv-2" },
      activeRitualNames: [],
      priorCatches: [prior({ status: "rejected", created_at: daysAgo(REJECTED_WINDOW_DAYS + 1) })],
      now: NOW,
    });
    expect(got).toEqual({ ok: true });
  });

  it("ignores other themes entirely", () => {
    const got = evaluateSignalDedup({
      candidate: CANDIDATE,
      activeRitualNames: ["Friday Lead Digest"],
      priorCatches: [prior({ theme_key: "friday-lead-digest", status: "rejected" })],
      now: NOW,
    });
    expect(got).toEqual({ ok: true });
  });
});
