import { describe, it, expect } from "vitest";
import { BROWSER_ACTION_CAPS, browserActionCap, evaluateBrowserActionCap } from "../tier";

describe("BROWSER_ACTION_CAPS", () => {
  it("encodes the prompt item-9 ladder (50 / 200 / unlimited)", () => {
    expect(BROWSER_ACTION_CAPS.starter).toBe(50);
    expect(BROWSER_ACTION_CAPS.pro).toBe(200);
    expect(BROWSER_ACTION_CAPS.pro_plus).toBeNull();
    expect(BROWSER_ACTION_CAPS.studio).toBeNull();
    expect(BROWSER_ACTION_CAPS.studio_plus).toBeNull();
    expect(BROWSER_ACTION_CAPS.enterprise).toBeNull();
  });
});

describe("evaluateBrowserActionCap", () => {
  it("passes under the cap and reports remaining", () => {
    const r = evaluateBrowserActionCap("starter", 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(40);
  });

  it("blocks at and over the cap with upgrade copy for cap'd tiers", () => {
    const at = evaluateBrowserActionCap("starter", 50);
    expect(at.ok).toBe(false);
    if (!at.ok) expect(at.reason).toMatch(/Upgrade/);

    const over = evaluateBrowserActionCap("pro", 250);
    expect(over.ok).toBe(false);
  });

  it("never blocks unlimited tiers", () => {
    const r = evaluateBrowserActionCap("pro_plus", 10_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBeNull();
    expect(evaluateBrowserActionCap("enterprise", 99_999).ok).toBe(true);
  });

  it("browserActionCap mirrors the table", () => {
    expect(browserActionCap("pro")).toBe(200);
    expect(browserActionCap("studio")).toBeNull();
  });
});
