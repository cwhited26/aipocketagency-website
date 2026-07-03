import { describe, expect, it } from "vitest";
import { evaluateRateLimit, isExpiredByTtl } from "../limits";
import { MAX_UNMIGRATED_TURNS, type TrialThreadRow } from "../types";

const NOW = new Date("2026-07-03T12:00:00.000Z");

function makeThread(overrides: Partial<TrialThreadRow> = {}): TrialThreadRow {
  return {
    sender_phone: "15551234567",
    thread_id: "11111111-1111-1111-1111-111111111111",
    composed_persona_slug: null,
    composed_apps: [],
    composed_skill_slugs: [],
    conversation_state: null,
    turn_count: 3,
    actions_delivered: 0,
    status: "active",
    starts_in_window: 1,
    window_started_at: NOW.toISOString(),
    cooloff_until: null,
    first_seen_at: NOW.toISOString(),
    last_active_at: NOW.toISOString(),
    converted_to_owner_id: null,
    ...overrides,
  };
}

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}

describe("evaluateRateLimit (§22.4)", () => {
  it("allows a first-ever sender as a fresh start", () => {
    const decision = evaluateRateLimit(null, NOW);
    expect(decision).toMatchObject({ allowed: true, restart: true, startsInWindow: 1 });
  });

  it("allows a live active thread without restart bookkeeping", () => {
    const decision = evaluateRateLimit(makeThread(), NOW);
    expect(decision).toMatchObject({ allowed: true, restart: false });
  });

  it("blocks a sender inside a post-cancel cool-off", () => {
    const decision = evaluateRateLimit(
      makeThread({ status: "expired", cooloff_until: hoursAgo(-24) }),
      NOW,
    );
    expect(decision).toMatchObject({ allowed: false, reason: "cooloff", notify: true });
  });

  it("lets a sender back in once the cool-off has passed", () => {
    const decision = evaluateRateLimit(
      makeThread({
        status: "expired",
        cooloff_until: hoursAgo(1),
        starts_in_window: 1,
        window_started_at: hoursAgo(30),
      }),
      NOW,
    );
    expect(decision).toMatchObject({ allowed: true, restart: true, startsInWindow: 1 });
  });

  it("counts restarts inside the 24h window and blocks the 4th", () => {
    const second = evaluateRateLimit(
      makeThread({ status: "expired", starts_in_window: 1, window_started_at: hoursAgo(2) }),
      NOW,
    );
    expect(second).toMatchObject({ allowed: true, startsInWindow: 2 });

    const fourth = evaluateRateLimit(
      makeThread({ status: "expired", starts_in_window: 3, window_started_at: hoursAgo(2) }),
      NOW,
    );
    expect(fourth).toMatchObject({ allowed: false, reason: "window_exhausted" });
  });

  it("resets the window after 24 hours", () => {
    const decision = evaluateRateLimit(
      makeThread({ status: "expired", starts_in_window: 3, window_started_at: hoursAgo(25) }),
      NOW,
    );
    expect(decision).toMatchObject({ allowed: true, startsInWindow: 1 });
  });

  it("pauses (with one notice) when the unmigrated turn cap lands", () => {
    const decision = evaluateRateLimit(
      makeThread({ turn_count: MAX_UNMIGRATED_TURNS }),
      NOW,
    );
    expect(decision).toMatchObject({ allowed: false, reason: "turn_cap", notify: true });
  });

  it("is hard-silent on an already-paused thread", () => {
    const decision = evaluateRateLimit(makeThread({ status: "paused" }), NOW);
    expect(decision).toMatchObject({ allowed: false, reason: "silent", notify: false });
  });

  it("keeps a converted thread talking past the turn cap", () => {
    const decision = evaluateRateLimit(
      makeThread({ status: "converted", turn_count: MAX_UNMIGRATED_TURNS + 10 }),
      NOW,
    );
    expect(decision).toMatchObject({ allowed: true, restart: false });
  });

  it("treats a stale-but-active thread as a TTL restart", () => {
    const stale = makeThread({
      last_active_at: hoursAgo(15 * 24),
      window_started_at: hoursAgo(15 * 24),
    });
    expect(isExpiredByTtl(stale, NOW)).toBe(true);
    const decision = evaluateRateLimit(stale, NOW);
    expect(decision).toMatchObject({ allowed: true, restart: true, startsInWindow: 1 });
  });
});
