import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_LIMITS,
  evaluateRateLimit,
  HOUR_MS,
  DAY_MS,
  limitForScope,
  windowStartIso,
} from "../rate-limit";

describe("windowStartIso", () => {
  it("buckets hour scopes to the top of the hour", () => {
    const t = new Date("2026-06-05T14:37:22.500Z");
    expect(windowStartIso("ip_hour", t)).toBe("2026-06-05T14:00:00.000Z");
    expect(windowStartIso("blocked_hour", t)).toBe("2026-06-05T14:00:00.000Z");
  });

  it("buckets day scopes to UTC midnight", () => {
    const t = new Date("2026-06-05T14:37:22.500Z");
    expect(windowStartIso("session_day", t)).toBe("2026-06-05T00:00:00.000Z");
    expect(windowStartIso("persona_day", t)).toBe("2026-06-05T00:00:00.000Z");
  });

  it("two timestamps in the same hour share a window; the next hour differs", () => {
    const a = new Date("2026-06-05T14:00:00.000Z");
    const b = new Date(a.getTime() + HOUR_MS - 1);
    const c = new Date(a.getTime() + HOUR_MS);
    expect(windowStartIso("ip_hour", a)).toBe(windowStartIso("ip_hour", b));
    expect(windowStartIso("ip_hour", a)).not.toBe(windowStartIso("ip_hour", c));
  });

  it("rolls the day window at the day boundary", () => {
    const a = new Date("2026-06-05T23:59:59.000Z");
    const b = new Date(a.getTime() + DAY_MS);
    expect(windowStartIso("persona_day", a)).not.toBe(windowStartIso("persona_day", b));
  });
});

describe("evaluateRateLimit — token-bucket math", () => {
  it("allows when the post-increment count is at or under the limit", () => {
    expect(evaluateRateLimit(1, 60, "ip_hour", "w").ok).toBe(true);
    expect(evaluateRateLimit(60, 60, "ip_hour", "w").ok).toBe(true);
  });

  it("blocks once the count exceeds the limit", () => {
    const v = evaluateRateLimit(61, 60, "ip_hour", "2026-06-05T15:00:00.000Z");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.scope).toBe("ip_hour");
      expect(v.retryAfter).toBe("2026-06-05T15:00:00.000Z");
    }
  });

  it("a limit of 1 blocks the second request in the window", () => {
    expect(evaluateRateLimit(1, 1, "session_day", "w").ok).toBe(true);
    expect(evaluateRateLimit(2, 1, "session_day", "w").ok).toBe(false);
  });
});

describe("limitForScope", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses the SPEC defaults when env is unset", () => {
    delete process.env.PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR;
    delete process.env.PA_PERSONAS_RATE_LIMIT_SESSION_PER_DAY;
    delete process.env.PA_PERSONAS_RATE_LIMIT_PERSONA_PER_DAY;
    expect(limitForScope("ip_hour")).toBe(DEFAULT_LIMITS.ip_hour);
    expect(limitForScope("session_day")).toBe(DEFAULT_LIMITS.session_day);
    expect(limitForScope("persona_day")).toBe(DEFAULT_LIMITS.persona_day);
  });

  it("reads overrides from env", () => {
    process.env.PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR = "10";
    process.env.PA_PERSONAS_RATE_LIMIT_SESSION_PER_DAY = "25";
    process.env.PA_PERSONAS_RATE_LIMIT_PERSONA_PER_DAY = "9000";
    expect(limitForScope("ip_hour")).toBe(10);
    expect(limitForScope("session_day")).toBe(25);
    expect(limitForScope("persona_day")).toBe(9000);
  });

  it("ignores a non-positive or garbage override", () => {
    process.env.PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR = "-5";
    expect(limitForScope("ip_hour")).toBe(DEFAULT_LIMITS.ip_hour);
    process.env.PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR = "abc";
    expect(limitForScope("ip_hour")).toBe(DEFAULT_LIMITS.ip_hour);
  });
});

describe("DEFAULT_LIMITS match the SPEC", () => {
  it("ip 60 / session 100 / persona 5000", () => {
    expect(DEFAULT_LIMITS.ip_hour).toBe(60);
    expect(DEFAULT_LIMITS.session_day).toBe(100);
    expect(DEFAULT_LIMITS.persona_day).toBe(5000);
  });
});
