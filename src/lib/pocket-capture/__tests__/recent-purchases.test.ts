import { describe, expect, it } from "vitest";
import {
  extractCity,
  isToastDismissed,
  nextPurchaseIndex,
  purchaseToastMessage,
} from "../recent-purchases";

describe("extractCity — Stripe session city fallbacks (PC-MARK-4)", () => {
  it("pulls the city from a fully-populated checkout session", () => {
    expect(
      extractCity({ customer_details: { address: { city: "Nashville" } } }),
    ).toBe("Nashville");
  });

  it("trims surrounding whitespace", () => {
    expect(extractCity({ customer_details: { address: { city: "  Austin  " } } })).toBe("Austin");
  });

  it("returns null when customer_details is missing", () => {
    expect(extractCity({})).toBeNull();
  });

  it("returns null when the address is missing", () => {
    expect(extractCity({ customer_details: {} })).toBeNull();
  });

  it("returns null when the address has no city", () => {
    expect(extractCity({ customer_details: { address: { country: "US" } } })).toBeNull();
  });

  it("returns null when the city is explicitly null", () => {
    expect(extractCity({ customer_details: { address: { city: null } } })).toBeNull();
  });

  it("returns null for a blank/whitespace-only city", () => {
    expect(extractCity({ customer_details: { address: { city: "   " } } })).toBeNull();
  });

  it("returns null for a non-object / non-string shape", () => {
    expect(extractCity(null)).toBeNull();
    expect(extractCity("Nashville")).toBeNull();
    expect(extractCity({ customer_details: { address: { city: 42 } } })).toBeNull();
  });
});

describe("purchaseToastMessage", () => {
  it("renders the exact SPEC §4.4 line with the city", () => {
    expect(purchaseToastMessage({ city: "Denver", purchased_at: "2026-06-23T00:00:00Z" })).toBe(
      "Someone from Denver just got Pocket Capture.",
    );
  });
});

describe("nextPurchaseIndex — widget rotation", () => {
  it("advances and wraps", () => {
    expect(nextPurchaseIndex(0, 3)).toBe(1);
    expect(nextPurchaseIndex(1, 3)).toBe(2);
    expect(nextPurchaseIndex(2, 3)).toBe(0);
  });

  it("stays at 0 with a single item", () => {
    expect(nextPurchaseIndex(0, 1)).toBe(0);
  });

  it("returns 0 when there are no items", () => {
    expect(nextPurchaseIndex(0, 0)).toBe(0);
    expect(nextPurchaseIndex(5, 0)).toBe(0);
  });
});

describe("isToastDismissed — persisted dismissal", () => {
  it("is dismissed only for the stored flag value", () => {
    expect(isToastDismissed("1")).toBe(true);
    expect(isToastDismissed(null)).toBe(false);
    expect(isToastDismissed("0")).toBe(false);
    expect(isToastDismissed("true")).toBe(false);
  });
});
