import { describe, it, expect } from "vitest";
import {
  evaluateRefuse,
  isForbiddenDomain,
  matchMoneyMovement,
  FORBIDDEN_DOMAIN_SUFFIXES,
  MONEY_MOVEMENT_PATTERNS,
} from "../refuse-list";

describe("isForbiddenDomain", () => {
  it("refuses each forbidden domain and its subdomains", () => {
    for (const suffix of FORBIDDEN_DOMAIN_SUFFIXES) {
      expect(isForbiddenDomain(`https://${suffix}/x`).forbidden).toBe(true);
      expect(isForbiddenDomain(`https://api.${suffix}/v1`).forbidden).toBe(true);
      expect(isForbiddenDomain(`https://deep.sub.${suffix}/`).forbidden).toBe(true);
    }
  });

  it("is label-boundary aware — a lookalike host is NOT forbidden", () => {
    expect(isForbiddenDomain("https://notopenai.com/").forbidden).toBe(false);
    expect(isForbiddenDomain("https://openai.com.evil.com/").forbidden).toBe(false);
  });

  it("allows ordinary business domains", () => {
    expect(isForbiddenDomain("https://quickbooks.intuit.com/app").forbidden).toBe(false);
    expect(isForbiddenDomain("https://example.com").forbidden).toBe(false);
  });

  it("refuses non-http(s) and unparseable URLs", () => {
    expect(isForbiddenDomain("file:///etc/passwd").forbidden).toBe(true);
    expect(isForbiddenDomain("chrome://settings").forbidden).toBe(true);
    expect(isForbiddenDomain("not a url").forbidden).toBe(true);
  });
});

describe("matchMoneyMovement", () => {
  it("matches each money-movement phrase in any surface", () => {
    for (const phrase of MONEY_MOVEMENT_PATTERNS) {
      expect(matchMoneyMovement([`Click the ${phrase} button`])).toBe(phrase);
    }
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(matchMoneyMovement(["Send   MONEY now"])).toBe("send money");
    expect(matchMoneyMovement([null, "button:has-text('Confirm Order')"])).toBe("confirm order");
  });

  it("returns null for benign actions (viewing reports is fine)", () => {
    expect(matchMoneyMovement(["https://quickbooks.com/reports/ar-aging"])).toBeNull();
    expect(matchMoneyMovement(["#invoice-table", "read the balance"])).toBeNull();
  });
});

describe("evaluateRefuse", () => {
  it("refuses a forbidden domain with the forbidden_domain family", () => {
    const r = evaluateRefuse({ url: "https://chat.openai.com/" });
    expect(r.refused).toBe(true);
    if (r.refused) expect(r.family).toBe("forbidden_domain");
  });

  it("refuses a money-movement action with the money_movement family", () => {
    const r = evaluateRefuse({ url: "https://bank.example.com/pay", selector: "button:has-text('Send Money')" });
    expect(r.refused).toBe(true);
    if (r.refused) expect(r.family).toBe("money_movement");
  });

  it("forbidden-domain wins over money-movement when both match", () => {
    const r = evaluateRefuse({ url: "https://openai.com/buy now", selector: "Send Money" });
    expect(r.refused).toBe(true);
    if (r.refused) expect(r.family).toBe("forbidden_domain");
  });

  it("passes an ordinary scrape", () => {
    expect(evaluateRefuse({ url: "https://example.com/pricing" }).refused).toBe(false);
  });
});
