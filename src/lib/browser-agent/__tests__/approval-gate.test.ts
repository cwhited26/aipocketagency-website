import { describe, it, expect } from "vitest";
import { classifyActionForApproval } from "../approval-gate";
import type { ElementInfo, PlannedAction } from "../types";

function el(overrides: Partial<ElementInfo>): ElementInfo {
  return {
    tag: "div",
    inputType: null,
    role: null,
    text: "",
    ariaLabel: null,
    href: null,
    inForm: false,
    isPasswordField: false,
    autocomplete: null,
    ...overrides,
  };
}

const CLICK: PlannedAction = { kind: "click", x: 100, y: 100, clickCount: 1, button: "left" };
const PAGE = "https://portal.example.com/apply";

describe("classifyActionForApproval — form submission (SPEC test a)", () => {
  it("flags a click on an <input type=submit>", () => {
    const d = classifyActionForApproval({
      action: CLICK,
      element: el({ tag: "input", inputType: "submit", inForm: true }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });

  it("flags a click on a <button> inside a form (implicit submit)", () => {
    const d = classifyActionForApproval({
      action: CLICK,
      element: el({ tag: "button", inputType: "submit", inForm: true, text: "Continue" }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });

  it('flags a click on a control labeled "Submit" even outside a form', () => {
    const d = classifyActionForApproval({
      action: CLICK,
      element: el({ tag: "div", role: "button", text: "Submit application" }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });

  it("flags Enter pressed while focus is inside a form", () => {
    const d = classifyActionForApproval({
      action: { kind: "key", text: "Return" },
      element: el({ tag: "input", inputType: "text", inForm: true }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });
});

describe("classifyActionForApproval — purchases, deletes, auth, domains", () => {
  it("flags checkout controls", () => {
    const d = classifyActionForApproval({
      action: CLICK,
      element: el({ tag: "a", text: "Proceed to checkout", href: "https://portal.example.com/cart" }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });

  it("flags delete / unsubscribe controls", () => {
    for (const text of ["Delete account", "Remove item", "Unsubscribe"]) {
      const d = classifyActionForApproval({
        action: CLICK,
        element: el({ tag: "button", inputType: "button", text }),
        currentUrl: PAGE,
      });
      expect(d.requiresApproval).toBe(true);
    }
  });

  it("never auto-types into a password field", () => {
    const d = classifyActionForApproval({
      action: { kind: "type", text: "hunter2" },
      element: el({ tag: "input", inputType: "password", isPasswordField: true, inForm: true }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(true);
  });

  it("flags navigation to a new registrable domain, passes same-domain", () => {
    const cross = classifyActionForApproval({
      action: { kind: "navigate", url: "https://elsewhere.net/page" },
      element: null,
      currentUrl: PAGE,
    });
    expect(cross.requiresApproval).toBe(true);

    const same = classifyActionForApproval({
      action: { kind: "navigate", url: "https://portal.example.com/fees" },
      element: null,
      currentUrl: PAGE,
    });
    expect(same.requiresApproval).toBe(false);
  });

  it("fails toward the card when a click's target can't be identified", () => {
    const d = classifyActionForApproval({ action: CLICK, element: null, currentUrl: PAGE });
    expect(d.requiresApproval).toBe(true);
  });
});

describe("classifyActionForApproval — read-only actions pass through", () => {
  it("screenshots, scrolls, and waits never stage a card", () => {
    for (const action of [
      { kind: "screenshot" } as const,
      { kind: "scroll", x: 10, y: 10, direction: "down", amount: 3 } as const,
      { kind: "wait", seconds: 1 } as const,
    ]) {
      const d = classifyActionForApproval({ action, element: null, currentUrl: PAGE });
      expect(d.requiresApproval).toBe(false);
    }
  });

  it("a plain link click on the same page passes through", () => {
    const d = classifyActionForApproval({
      action: CLICK,
      element: el({ tag: "a", text: "Fee schedule", href: "https://portal.example.com/fees" }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(false);
  });

  it("typing into an ordinary search box passes through", () => {
    const d = classifyActionForApproval({
      action: { kind: "type", text: "reroof permit" },
      element: el({ tag: "input", inputType: "search" }),
      currentUrl: PAGE,
    });
    expect(d.requiresApproval).toBe(false);
  });
});
