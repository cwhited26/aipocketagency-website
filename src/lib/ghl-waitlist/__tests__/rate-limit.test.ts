// Fixed-window rate limiter for the public waitlist endpoint — the pure window math the route's
// 429 depends on, driven with a fake clock.

import { describe, expect, it } from "vitest";
import {
  hitRateLimit,
  pruneExpired,
  MAX_PER_WINDOW,
  WINDOW_MS,
  type RateWindow,
} from "../rate-limit";

const T0 = 1_750_000_000_000;

describe("hitRateLimit", () => {
  it("allows up to MAX_PER_WINDOW hits in one window, then blocks", () => {
    const store = new Map<string, RateWindow>();
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(hitRateLimit(store, "1.2.3.4", T0 + i).ok).toBe(true);
    }
    const blocked = hitRateLimit(store, "1.2.3.4", T0 + MAX_PER_WINDOW);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
    }
  });

  it("tracks IPs independently", () => {
    const store = new Map<string, RateWindow>();
    for (let i = 0; i <= MAX_PER_WINDOW; i++) hitRateLimit(store, "1.2.3.4", T0);
    expect(hitRateLimit(store, "5.6.7.8", T0).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    const store = new Map<string, RateWindow>();
    for (let i = 0; i <= MAX_PER_WINDOW; i++) hitRateLimit(store, "1.2.3.4", T0);
    expect(hitRateLimit(store, "1.2.3.4", T0).ok).toBe(false);
    expect(hitRateLimit(store, "1.2.3.4", T0 + WINDOW_MS).ok).toBe(true);
  });
});

describe("pruneExpired", () => {
  it("drops expired windows and keeps live ones", () => {
    const store = new Map<string, RateWindow>();
    hitRateLimit(store, "old", T0);
    hitRateLimit(store, "fresh", T0 + WINDOW_MS - 1);
    pruneExpired(store, T0 + WINDOW_MS);
    expect(store.has("old")).toBe(false);
    expect(store.has("fresh")).toBe(true);
  });
});
