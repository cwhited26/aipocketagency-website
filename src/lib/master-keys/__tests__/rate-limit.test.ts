import { describe, it, expect } from "vitest";
import { hitRateLimit, pruneExpired, type RateWindow } from "../rate-limit";

describe("master-keys/rate-limit", () => {
  it("allows up to 100 hits per key per minute, then blocks", () => {
    const store = new Map<string, RateWindow>();
    const now = 1_000_000;
    for (let i = 0; i < 100; i++) {
      expect(hitRateLimit(store, "key-a", now).ok).toBe(true);
    }
    const blocked = hitRateLimit(store, "key-a", now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the 60s window elapses", () => {
    const store = new Map<string, RateWindow>();
    const now = 1_000_000;
    for (let i = 0; i < 100; i++) hitRateLimit(store, "key-a", now);
    expect(hitRateLimit(store, "key-a", now).ok).toBe(false);
    expect(hitRateLimit(store, "key-a", now + 60_001).ok).toBe(true);
  });

  it("meters each master key independently", () => {
    const store = new Map<string, RateWindow>();
    const now = 1_000_000;
    for (let i = 0; i < 100; i++) hitRateLimit(store, "key-a", now);
    expect(hitRateLimit(store, "key-a", now).ok).toBe(false);
    expect(hitRateLimit(store, "key-b", now).ok).toBe(true);
  });

  it("pruneExpired drops only windows past their reset", () => {
    const store = new Map<string, RateWindow>();
    store.set("stale", { count: 5, resetAt: 500 });
    store.set("live", { count: 5, resetAt: 2000 });
    pruneExpired(store, 1000);
    expect(store.has("stale")).toBe(false);
    expect(store.has("live")).toBe(true);
  });
});
