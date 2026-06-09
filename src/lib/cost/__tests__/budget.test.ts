import { describe, it, expect } from "vitest";
import {
  evaluateGate,
  spentPct,
  tierDefaultBudgetCents,
  TIER_DEFAULT_BUDGET_CENTS,
  periodStartMs,
  periodResetMs,
  periodStartDate,
  MICRO_CENTS_PER_CENT,
} from "../budget";

// $100 cap = 10,000 cents = 100,000,000 micro-cents.
const CAP_CENTS = 10000;
const CAP_MICRO = CAP_CENTS * MICRO_CENTS_PER_CENT;

describe("spentPct", () => {
  it("computes percent of cap from micro-cents spend", () => {
    expect(spentPct(CAP_MICRO / 2, CAP_CENTS)).toBe(50);
    expect(spentPct(CAP_MICRO, CAP_CENTS)).toBe(100);
    expect(spentPct(CAP_MICRO * 1.5, CAP_CENTS)).toBe(150);
  });

  it("treats a $0 cap as 0% when nothing spent, 100%+ once anything is spent", () => {
    expect(spentPct(0, 0)).toBe(0);
    expect(spentPct(1, 0)).toBe(100);
  });
});

describe("evaluateGate (SPEC §5.4 thresholds)", () => {
  it("ok below 80%", () => {
    expect(evaluateGate(CAP_MICRO * 0.5, CAP_CENTS, null).status).toBe("ok");
    expect(evaluateGate(CAP_MICRO * 0.799, CAP_CENTS, null).status).toBe("ok");
  });

  it("warns from 80% up to (not including) 100% when unacknowledged", () => {
    expect(evaluateGate(CAP_MICRO * 0.8, CAP_CENTS, null).status).toBe("warn_80");
    expect(evaluateGate(CAP_MICRO * 0.99, CAP_CENTS, null).status).toBe("warn_80");
  });

  it("keep_going suppresses the 80% warn but NOT the 100% gate", () => {
    expect(evaluateGate(CAP_MICRO * 0.9, CAP_CENTS, "keep_going").status).toBe("ok");
    expect(evaluateGate(CAP_MICRO * 1.0, CAP_CENTS, "keep_going").status).toBe("block_100");
  });

  it("blocks at 100% and above regardless of decision", () => {
    expect(evaluateGate(CAP_MICRO, CAP_CENTS, null).status).toBe("block_100");
    expect(evaluateGate(CAP_MICRO * 2, CAP_CENTS, null).status).toBe("block_100");
  });

  it("pause blocks every new dispatch even below 80%", () => {
    expect(evaluateGate(CAP_MICRO * 0.1, CAP_CENTS, "pause").status).toBe("block_100");
    expect(evaluateGate(0, CAP_CENTS, "pause").status).toBe("block_100");
  });

  it("a $0 cap blocks the first dollar of spend (lowering below spend trips the gate)", () => {
    expect(evaluateGate(0, 0, null).status).toBe("ok");
    expect(evaluateGate(1, 0, null).status).toBe("block_100");
  });

  it("carries spend/budget/pct through for the surface copy", () => {
    const g = evaluateGate(CAP_MICRO * 0.84, CAP_CENTS, null);
    expect(g.budgetCents).toBe(CAP_CENTS);
    expect(Math.round(g.pct)).toBe(84);
  });
});

describe("tier defaults (mirror migration 053 seed)", () => {
  it("matches the SPEC §5.3 ladder", () => {
    expect(tierDefaultBudgetCents("starter")).toBe(0);
    expect(tierDefaultBudgetCents("pro")).toBe(2500);
    expect(tierDefaultBudgetCents("pro_plus")).toBe(5000);
    expect(tierDefaultBudgetCents("studio")).toBe(10000);
    expect(tierDefaultBudgetCents("studio_plus")).toBe(40000);
    expect(tierDefaultBudgetCents("enterprise")).toBe(200000);
  });

  it("covers every tier in the map", () => {
    expect(Object.keys(TIER_DEFAULT_BUDGET_CENTS).sort()).toEqual(
      ["enterprise", "pro", "pro_plus", "starter", "studio", "studio_plus"],
    );
  });
});

describe("period math (UTC calendar month)", () => {
  // 2026-06-09T12:00:00Z
  const now = Date.UTC(2026, 5, 9, 12, 0, 0);

  it("period start is the 1st of the month at UTC midnight", () => {
    expect(new Date(periodStartMs(now)).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("period reset is the 1st of next month", () => {
    expect(new Date(periodResetMs(now)).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("December rolls reset into next January", () => {
    const dec = Date.UTC(2026, 11, 20, 0, 0, 0);
    expect(new Date(periodResetMs(dec)).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("period key is the YYYY-MM-DD month start", () => {
    expect(periodStartDate(now)).toBe("2026-06-01");
  });
});
