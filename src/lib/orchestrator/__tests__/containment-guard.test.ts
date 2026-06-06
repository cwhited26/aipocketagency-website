import { describe, it, expect } from "vitest";
import {
  ConnectorScopeError,
  scopeToken,
  isActionAllowed,
  assertActionAllowed,
  partitionAllowedActions,
} from "../containment-guard";

describe("scopeToken", () => {
  it("lowercases + joins connector:action", () => {
    expect(scopeToken("Gmail", "Send")).toBe("gmail:send");
  });
});

describe("isActionAllowed (ContainmentGuard action paths)", () => {
  it("allows an exact connector:action scope", () => {
    expect(isActionAllowed("gmail", "send", ["gmail:send"])).toBe(true);
  });
  it("allows a connector wildcard (bare name or connector:*)", () => {
    expect(isActionAllowed("gmail", "send", ["gmail"])).toBe(true);
    expect(isActionAllowed("gmail", "archive", ["gmail:*"])).toBe(true);
  });
  it("allows the global wildcard", () => {
    expect(isActionAllowed("stripe", "refund", ["*"])).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isActionAllowed("Gmail", "SEND", ["gmail:send"])).toBe(true);
  });
  it("fails closed for an undeclared connector", () => {
    expect(isActionAllowed("stripe", "refund", ["gmail:send", "slack"])).toBe(false);
  });
  it("fails closed for a wrong action on a declared connector", () => {
    expect(isActionAllowed("gmail", "delete", ["gmail:send"])).toBe(false);
  });
  it("fails closed for empty / whitespace scopes", () => {
    expect(isActionAllowed("gmail", "send", [])).toBe(false);
    expect(isActionAllowed("gmail", "send", ["", "   "])).toBe(false);
  });
  it("fails closed for empty connector/action", () => {
    expect(isActionAllowed("", "send", ["*"])).toBe(false);
    expect(isActionAllowed("gmail", "", ["*"])).toBe(false);
  });
});

describe("assertActionAllowed", () => {
  it("returns void when allowed", () => {
    expect(() => assertActionAllowed("gmail", "send", ["gmail"])).not.toThrow();
  });
  it("throws a typed ConnectorScopeError when out of scope", () => {
    try {
      assertActionAllowed("stripe", "refund", ["gmail:send"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConnectorScopeError);
      const err = e as ConnectorScopeError;
      expect(err.connector).toBe("stripe");
      expect(err.action).toBe("refund");
      expect(err.userMessage).toMatch(/outside this run's approved scope/);
    }
  });
});

describe("partitionAllowedActions", () => {
  it("splits a batch into allowed + blocked without throwing", () => {
    const { allowed, blocked } = partitionAllowedActions(
      [
        { connector: "gmail", action: "send" },
        { connector: "stripe", action: "refund" },
        { connector: "slack", action: "post" },
      ],
      ["gmail:send", "slack"],
    );
    expect(allowed).toEqual([
      { connector: "gmail", action: "send" },
      { connector: "slack", action: "post" },
    ]);
    expect(blocked).toEqual([{ connector: "stripe", action: "refund" }]);
  });
});
