// Unit tests for the natural-language schedule parser + the cron next-run math (lib/rituals/parser).
// Pure module — no I/O. Covers the lookup phrases the SPEC §7 names, the day/time fallbacks, the
// bi-weekly flag, the fail-closed picker path, and the cron evaluation (next run, the N-run preview,
// the OR day semantics, and bi-weekly ~14-day spacing).

import { describe, expect, it } from "vitest";
import { parseSchedule, cronNextRun, nextRuns } from "../parser";

function cronOf(text: string): string {
  const r = parseSchedule(text);
  if (!r.ok) throw new Error(`expected parse, got: ${r.reason}`);
  return r.schedule.cron;
}

describe("parseSchedule — the SPEC §7 lookup phrases", () => {
  it("every day at 7am", () => {
    expect(cronOf("every day at 7am")).toBe("0 7 * * *");
  });
  it("weekdays at 9", () => {
    expect(cronOf("weekdays at 9")).toBe("0 9 * * 1-5");
  });
  it("every Monday morning", () => {
    expect(cronOf("every Monday morning")).toBe("0 8 * * 1");
  });
  it("monthly on the first", () => {
    expect(cronOf("monthly on the first")).toBe("0 9 1 * *");
  });
  it("every 6 hours", () => {
    expect(cronOf("every 6 hours")).toBe("0 */6 * * *");
  });
  it("every 15 minutes", () => {
    expect(cronOf("every 15 minutes")).toBe("*/15 * * * *");
  });
});

describe("parseSchedule — days, times, intervals", () => {
  it("a named day with an explicit pm time", () => {
    expect(cronOf("every Wednesday at 5pm")).toBe("0 17 * * 3");
  });
  it("weekends at 10am", () => {
    expect(cronOf("weekends at 10am")).toBe("0 10 * * 0,6");
  });
  it("a bare time defaults to daily", () => {
    expect(cronOf("at 6:30am")).toBe("30 6 * * *");
  });
  it("hourly", () => {
    expect(cronOf("hourly")).toBe("0 * * * *");
  });
  it("monthly on a numbered day", () => {
    expect(cronOf("every month on the 15th at 8am")).toBe("0 8 15 * *");
  });
  it("end of day on weekdays", () => {
    expect(cronOf("weekdays end of day")).toBe("0 17 * * 1-5");
  });
});

describe("parseSchedule — bi-weekly", () => {
  it("flags every other <day> and emits the weekly cron", () => {
    const r = parseSchedule("every other Wednesday at 8am");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.schedule.cron).toBe("0 8 * * 3");
    expect(r.schedule.biWeekly).toBe(true);
  });
});

describe("parseSchedule — fail closed to the picker", () => {
  it("returns a reason when nothing is extractable", () => {
    const r = parseSchedule("sometime whenever it feels right");
    expect(r.ok).toBe(false);
  });
  it("rejects empty input", () => {
    expect(parseSchedule("   ").ok).toBe(false);
  });
});

describe("cronNextRun", () => {
  it("finds the next matching minute strictly after `from` (UTC)", () => {
    // 2026-06-08 is a Monday. From 07:00, the next Monday-08:00 is the same day at 08:00.
    const from = new Date("2026-06-08T07:00:00.000Z");
    const next = cronNextRun("0 8 * * 1", from);
    expect(next).not.toBeNull();
    if (!next) return;
    expect(next.getUTCDay()).toBe(1);
    expect(next.getUTCHours()).toBe(8);
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it("every-15-minutes lands on a quarter-hour within 15 minutes", () => {
    const from = new Date("2026-06-08T07:02:00.000Z");
    const next = cronNextRun("*/15 * * * *", from);
    expect(next).not.toBeNull();
    if (!next) return;
    expect(next.getUTCMinutes() % 15).toBe(0);
    expect(next.getTime() - from.getTime()).toBeLessThanOrEqual(15 * 60_000);
  });

  it("quarterly cron resolves to a month in the list on the 1st", () => {
    const from = new Date("2026-06-08T00:00:00.000Z");
    const next = cronNextRun("0 10 1 1,4,7,10 *", from);
    expect(next).not.toBeNull();
    if (!next) return;
    expect([1, 4, 7, 10]).toContain(next.getUTCMonth() + 1);
    expect(next.getUTCDate()).toBe(1);
    expect(next.getUTCHours()).toBe(10);
  });

  it("returns null for an unparseable cron", () => {
    expect(cronNextRun("not a cron", new Date())).toBeNull();
  });
});

describe("nextRuns", () => {
  it("returns N strictly-increasing run times", () => {
    const runs = nextRuns("0 9 * * 1-5", 3, new Date("2026-06-08T00:00:00.000Z"));
    expect(runs).toHaveLength(3);
    expect(runs[1].getTime()).toBeGreaterThan(runs[0].getTime());
    expect(runs[2].getTime()).toBeGreaterThan(runs[1].getTime());
    for (const r of runs) {
      // every match is a weekday at 09:00
      expect(r.getUTCDay()).toBeGreaterThanOrEqual(1);
      expect(r.getUTCDay()).toBeLessThanOrEqual(5);
      expect(r.getUTCHours()).toBe(9);
    }
  });

  it("bi-weekly spaces consecutive runs roughly two weeks apart", () => {
    const from = new Date("2026-06-08T00:00:00.000Z");
    const runs = nextRuns("0 8 * * 3", 3, from, { biWeekly: true, lastRunAt: from });
    expect(runs.length).toBeGreaterThanOrEqual(2);
    const gapDays = (runs[1].getTime() - runs[0].getTime()) / (24 * 60 * 60 * 1000);
    expect(gapDays).toBeGreaterThanOrEqual(13);
    expect(gapDays).toBeLessThanOrEqual(15);
  });
});
