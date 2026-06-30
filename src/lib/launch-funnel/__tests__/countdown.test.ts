import { describe, it, expect } from "vitest";
import {
  COUNTDOWN_TOTAL_SECONDS,
  deadlineFromStart,
  formatCountdown,
  remainingSeconds,
  resolveDeadline,
} from "../countdown";

const NOW = 1_700_000_000_000;

describe("countdown deadline math", () => {
  it("derives a 15-minute deadline from session start", () => {
    expect(deadlineFromStart(NOW)).toBe(NOW + COUNTDOWN_TOTAL_SECONDS * 1000);
    expect(COUNTDOWN_TOTAL_SECONDS).toBe(900);
  });

  it("counts down whole seconds and clamps at zero", () => {
    const deadline = deadlineFromStart(NOW);
    expect(remainingSeconds(deadline, NOW)).toBe(900);
    expect(remainingSeconds(deadline, NOW + 60_000)).toBe(840);
    expect(remainingSeconds(deadline, deadline + 5_000)).toBe(0); // past → 0
  });

  it("formats MM:SS with zero padding", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(5)).toBe("00:05");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-10)).toBe("00:00");
  });
});

describe("countdown persistence (resolveDeadline)", () => {
  it("honors a valid stored deadline so a refresh resumes the same timer", () => {
    const stored = String(NOW + 300_000); // 5 min left
    expect(resolveDeadline(stored, NOW)).toBe(NOW + 300_000);
  });

  it("keeps an already-expired stored deadline (no urgency reset)", () => {
    const expired = String(NOW - 1000);
    expect(resolveDeadline(expired, NOW)).toBe(NOW - 1000);
    expect(remainingSeconds(resolveDeadline(expired, NOW), NOW)).toBe(0);
  });

  it("resets on missing, non-numeric, non-positive, or corrupt-future values", () => {
    const fresh = NOW + COUNTDOWN_TOTAL_SECONDS * 1000;
    expect(resolveDeadline(null, NOW)).toBe(fresh);
    expect(resolveDeadline("", NOW)).toBe(fresh);
    expect(resolveDeadline("not-a-number", NOW)).toBe(fresh);
    expect(resolveDeadline("0", NOW)).toBe(fresh);
    expect(resolveDeadline("-500", NOW)).toBe(fresh);
    // implausibly far future (more than the full window ahead) → treated as corrupt
    expect(resolveDeadline(String(NOW + 999_999_999), NOW)).toBe(fresh);
  });
});
