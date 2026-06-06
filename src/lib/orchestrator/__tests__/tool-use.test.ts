import { describe, it, expect } from "vitest";
import {
  nextActionStatus,
  payloadHash,
  TRUST_WINDOW,
  isActionAllowed,
} from "../tool-use";
import { AUTO_APPROVE_TRUST_WINDOW } from "../tier-caps";
import type { ActionStatus } from "../types";

describe("nextActionStatus (approval-gate state machine)", () => {
  it("staged → approve/reject/fail", () => {
    expect(nextActionStatus("staged", "approve")).toBe("approved");
    expect(nextActionStatus("staged", "reject")).toBe("rejected");
    expect(nextActionStatus("staged", "fail")).toBe("failed");
  });
  it("staged cannot jump straight to executed", () => {
    expect(nextActionStatus("staged", "execute")).toBeNull();
  });
  it("approved → execute/fail/reject", () => {
    expect(nextActionStatus("approved", "execute")).toBe("executed");
    expect(nextActionStatus("approved", "fail")).toBe("failed");
    expect(nextActionStatus("approved", "reject")).toBe("rejected");
  });
  it("approved cannot be re-approved", () => {
    expect(nextActionStatus("approved", "approve")).toBeNull();
  });
  it("terminal states accept no further events", () => {
    const terminals: ActionStatus[] = ["executed", "rejected", "failed"];
    for (const t of terminals) {
      expect(nextActionStatus(t, "approve")).toBeNull();
      expect(nextActionStatus(t, "execute")).toBeNull();
      expect(nextActionStatus(t, "reject")).toBeNull();
      expect(nextActionStatus(t, "fail")).toBeNull();
    }
  });
});

describe("payloadHash", () => {
  it("is deterministic + stable for equal payloads", () => {
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ a: 1, b: 2 }));
  });
  it("differs for different payloads", () => {
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
  });
  it("handles null / undefined", () => {
    expect(payloadHash(null)).toBe(payloadHash(undefined));
  });
});

describe("re-exports from containment-guard / tier-caps", () => {
  it("re-exports the scope check", () => {
    expect(isActionAllowed("gmail", "send", ["gmail"])).toBe(true);
  });
  it("TRUST_WINDOW mirrors the canonical constant", () => {
    expect(TRUST_WINDOW).toBe(AUTO_APPROVE_TRUST_WINDOW);
  });
});
