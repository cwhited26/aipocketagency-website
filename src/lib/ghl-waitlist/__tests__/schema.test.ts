// GhlWaitlistSchema boundary behavior: trimming, email normalization, count coercion, and the
// rejection paths the API route's 400 depends on.

import { describe, expect, it } from "vitest";
import { GhlWaitlistSchema } from "../schema";

const VALID = {
  name: "Janie Villers-Colbaugh",
  email: "Janie@Example.com",
  agencyName: "Villers Media",
  clientCount: "12",
  topFrustration: "Same funnel built 30 times.",
  referrer: "https://facebook.com/groups/ghl-boss",
};

describe("GhlWaitlistSchema", () => {
  it("accepts a valid payload, lowercasing the email and coercing the count", () => {
    const parsed = GhlWaitlistSchema.parse(VALID);
    expect(parsed.email).toBe("janie@example.com");
    expect(parsed.clientCount).toBe(12);
    expect(parsed.name).toBe("Janie Villers-Colbaugh");
  });

  it("trims whitespace on string fields", () => {
    const parsed = GhlWaitlistSchema.parse({
      ...VALID,
      name: "  Janie  ",
      agencyName: " Villers Media ",
      topFrustration: "  reports  ",
    });
    expect(parsed.name).toBe("Janie");
    expect(parsed.agencyName).toBe("Villers Media");
    expect(parsed.topFrustration).toBe("reports");
  });

  it("defaults a missing referrer to empty string", () => {
    const { referrer, ...withoutReferrer } = VALID;
    void referrer;
    const parsed = GhlWaitlistSchema.parse(withoutReferrer);
    expect(parsed.referrer).toBe("");
  });

  it.each([
    ["missing name", { ...VALID, name: "" }],
    ["whitespace-only name", { ...VALID, name: "   " }],
    ["invalid email", { ...VALID, email: "not-an-email" }],
    ["missing agency name", { ...VALID, agencyName: "" }],
    ["non-numeric count", { ...VALID, clientCount: "a lot" }],
    ["negative count", { ...VALID, clientCount: "-3" }],
    ["fractional count", { ...VALID, clientCount: "2.5" }],
    ["count over cap", { ...VALID, clientCount: "10001" }],
    ["missing frustration", { ...VALID, topFrustration: "" }],
    ["oversized frustration", { ...VALID, topFrustration: "x".repeat(2001) }],
  ])("rejects %s", (_label, payload) => {
    expect(GhlWaitlistSchema.safeParse(payload).success).toBe(false);
  });
});
