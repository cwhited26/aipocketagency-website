import { describe, it, expect } from "vitest";
import { decideSignupSideEffects } from "../pocket-agent-signup";

describe("decideSignupSideEffects (pay-first post-subscribe branching)", () => {
  it("signed-in buyer: no login link, no reseed, no alert", () => {
    const fx = decideSignupSideEffects({
      metaUserId: "user-123",
      wasCreated: false,
      hadPriorActiveSub: false,
    });
    expect(fx).toEqual({
      sendLoginLink: false,
      seedLaunchKit: false,
      notifyOperator: null,
      anonymousSignup: false,
    });
  });

  it("pay-first brand-new account: login link + seed, flagged anonymous, no alert", () => {
    const fx = decideSignupSideEffects({
      metaUserId: null,
      wasCreated: true,
      hadPriorActiveSub: false,
    });
    expect(fx.sendLoginLink).toBe(true);
    expect(fx.seedLaunchKit).toBe(true);
    expect(fx.anonymousSignup).toBe(true);
    expect(fx.notifyOperator).toBeNull();
  });

  it("free-then-pay (existing account, no prior active sub): link + seed, not flagged new, no alert", () => {
    const fx = decideSignupSideEffects({
      metaUserId: null,
      wasCreated: false,
      hadPriorActiveSub: false,
    });
    expect(fx.sendLoginLink).toBe(true);
    expect(fx.seedLaunchKit).toBe(true);
    expect(fx.anonymousSignup).toBe(false);
    expect(fx.notifyOperator).toBeNull();
  });

  it("double-buy (existing account WITH a live sub): alerts the operator", () => {
    const fx = decideSignupSideEffects({
      metaUserId: null,
      wasCreated: false,
      hadPriorActiveSub: true,
    });
    expect(fx.notifyOperator).toBe("double_buy");
    expect(fx.sendLoginLink).toBe(true);
  });

  it("a signed-in buyer never triggers the double-buy alert even with a prior sub", () => {
    const fx = decideSignupSideEffects({
      metaUserId: "user-123",
      wasCreated: false,
      hadPriorActiveSub: true,
    });
    expect(fx.notifyOperator).toBeNull();
  });
});
