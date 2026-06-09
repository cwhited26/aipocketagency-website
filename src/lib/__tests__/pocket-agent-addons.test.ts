import { describe, it, expect } from "vitest";
import {
  ADDON_CATALOG,
  LAUNCH_KIT_BONUS,
  formatAddonPrice,
  getAddonMeta,
  isAddonCheckoutKind,
  type AddonCheckoutKind,
} from "../pocket-agent-addons";
import { buildAddonCheckoutParams } from "../pocket-agent-addon-checkout";

describe("pocket-agent-addons catalog", () => {
  it("prices the three funnel money-model products at the locked amounts", () => {
    expect(ADDON_CATALOG.setup_standard.amountCents).toBe(99_700);
    expect(ADDON_CATALOG.setup_premium.amountCents).toBe(250_000);
    expect(ADDON_CATALOG.pilot.amountCents).toBe(9_700);
  });

  it("keeps the included Launch Kit bonus at $0 (never charged)", () => {
    expect(LAUNCH_KIT_BONUS.amountCents).toBe(0);
    expect(LAUNCH_KIT_BONUS.slug).toBe("ai-office-launch-kit");
  });

  it("routes each charged product to the right /thanks branch", () => {
    expect(ADDON_CATALOG.setup_standard.thanksBranch).toBe("subscription_plus_setup");
    expect(ADDON_CATALOG.setup_premium.thanksBranch).toBe("subscription_plus_setup");
    expect(ADDON_CATALOG.pilot.thanksBranch).toBe("pilot");
  });

  it("exposes the four canonical product slugs", () => {
    const slugs = [
      ADDON_CATALOG.setup_standard.slug,
      ADDON_CATALOG.setup_premium.slug,
      ADDON_CATALOG.pilot.slug,
      LAUNCH_KIT_BONUS.slug,
    ];
    expect(slugs).toEqual([
      "done-with-you-setup-standard",
      "done-with-you-setup-premium",
      "ai-agent-workspace-pilot",
      "ai-office-launch-kit",
    ]);
  });

  it("isAddonCheckoutKind accepts only the three charged kinds", () => {
    expect(isAddonCheckoutKind("setup_standard")).toBe(true);
    expect(isAddonCheckoutKind("setup_premium")).toBe(true);
    expect(isAddonCheckoutKind("pilot")).toBe(true);
    expect(isAddonCheckoutKind("ai-office-launch-kit")).toBe(false);
    expect(isAddonCheckoutKind("subscription")).toBe(false);
    expect(isAddonCheckoutKind(null)).toBe(false);
  });

  it("formats whole-dollar prices without cents", () => {
    expect(formatAddonPrice(99_700)).toBe("$997");
    expect(formatAddonPrice(250_000)).toBe("$2,500");
    expect(formatAddonPrice(9_700)).toBe("$97");
  });
});

describe("buildAddonCheckoutParams", () => {
  const base = {
    origin: "https://aipocketagent.com",
    email: "owner@example.com",
    userId: "user-9",
  };

  it("builds a one-time charge with an inline price for each kind", () => {
    const kinds: AddonCheckoutKind[] = ["setup_standard", "setup_premium", "pilot"];
    for (const kind of kinds) {
      const p = buildAddonCheckoutParams({
        ...base,
        kind,
        successPath: "/thanks?bought=pilot",
        cancelPath: "/downsell",
        customerId: null,
      });
      expect(p.get("mode")).toBe("payment");
      expect(p.get("line_items[0][price_data][unit_amount]")).toBe(
        String(getAddonMeta(kind).amountCents),
      );
      expect(p.get("line_items[0][price_data][product_data][name]")).toBe(
        getAddonMeta(kind).name,
      );
      expect(p.get("metadata[source]")).toBe("pocket_agent_addon");
      expect(p.get("metadata[addon_kind]")).toBe(kind);
      expect(p.get("payment_intent_data[metadata][addon_kind]")).toBe(kind);
    }
  });

  it("ties the setup charge to the prior customer when present (upsell)", () => {
    const p = buildAddonCheckoutParams({
      ...base,
      kind: "setup_standard",
      successPath: "/thanks?bought=subscription_plus_setup",
      cancelPath: "/upsell",
      customerId: "cus_123",
    });
    expect(p.get("customer")).toBe("cus_123");
    // customer_email must not be set when a customer id is supplied.
    expect(p.get("customer_email")).toBeNull();
  });

  it("falls back to customer_email for the pilot (no prior customer)", () => {
    const p = buildAddonCheckoutParams({
      ...base,
      kind: "pilot",
      successPath: "/thanks?bought=pilot",
      cancelPath: "/downsell",
      customerId: null,
    });
    expect(p.get("customer")).toBeNull();
    expect(p.get("customer_email")).toBe("owner@example.com");
  });

  it("composes absolute success/cancel urls from origin + path", () => {
    const p = buildAddonCheckoutParams({
      ...base,
      kind: "pilot",
      successPath: "/thanks?bought=pilot",
      cancelPath: "/downsell",
      customerId: null,
    });
    expect(p.get("success_url")).toBe(
      "https://aipocketagent.com/thanks?bought=pilot",
    );
    expect(p.get("cancel_url")).toBe("https://aipocketagent.com/downsell");
  });

  it("threads user_id into client_reference_id + metadata when signed in", () => {
    const p = buildAddonCheckoutParams({
      ...base,
      kind: "setup_premium",
      successPath: "/thanks?bought=subscription_plus_setup",
      cancelPath: "/upsell",
      customerId: "cus_x",
    });
    expect(p.get("client_reference_id")).toBe("user-9");
    expect(p.get("metadata[user_id]")).toBe("user-9");
  });
});
