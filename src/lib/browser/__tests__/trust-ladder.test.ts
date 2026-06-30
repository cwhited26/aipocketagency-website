import { describe, it, expect } from "vitest";
import {
  resolveDomainDecision,
  canUnlockAutoApprove,
  approvalsUntilUnlock,
  TRUST_LADDER_THRESHOLD,
  type DomainPermission,
} from "../trust-ladder";

describe("canUnlockAutoApprove", () => {
  it("unlocks at exactly the threshold and above", () => {
    expect(canUnlockAutoApprove(TRUST_LADDER_THRESHOLD - 1)).toBe(false);
    expect(canUnlockAutoApprove(TRUST_LADDER_THRESHOLD)).toBe(true);
    expect(canUnlockAutoApprove(TRUST_LADDER_THRESHOLD + 10)).toBe(true);
  });

  it("the threshold is 5 (prompt item 7)", () => {
    expect(TRUST_LADDER_THRESHOLD).toBe(5);
  });
});

describe("approvalsUntilUnlock", () => {
  it("counts down to zero and never goes negative", () => {
    expect(approvalsUntilUnlock(0)).toBe(5);
    expect(approvalsUntilUnlock(4)).toBe(1);
    expect(approvalsUntilUnlock(5)).toBe(0);
    expect(approvalsUntilUnlock(9)).toBe(0);
  });
});

describe("resolveDomainDecision", () => {
  const allow = (autoApprove: boolean): DomainPermission => ({ decision: "allow", autoApprove });
  const deny: DomainPermission = { decision: "deny", autoApprove: false };

  it("defaults to manual when there is no stored rule", () => {
    expect(resolveDomainDecision(null, 0)).toBe("manual");
    expect(resolveDomainDecision(null, 100)).toBe("manual");
  });

  it("denies a deny rule regardless of count", () => {
    expect(resolveDomainDecision(deny, 0)).toBe("deny");
    expect(resolveDomainDecision(deny, 50)).toBe("deny");
  });

  it("allow + auto runs auto ONLY once the ladder unlocks", () => {
    expect(resolveDomainDecision(allow(true), TRUST_LADDER_THRESHOLD - 1)).toBe("manual");
    expect(resolveDomainDecision(allow(true), TRUST_LADDER_THRESHOLD)).toBe("auto");
  });

  it("allow without auto stays manual even past the threshold", () => {
    expect(resolveDomainDecision(allow(false), 100)).toBe("manual");
  });

  it("a stale auto flag below the threshold falls back to manual (belt-and-suspenders)", () => {
    expect(resolveDomainDecision(allow(true), 0)).toBe("manual");
  });
});
