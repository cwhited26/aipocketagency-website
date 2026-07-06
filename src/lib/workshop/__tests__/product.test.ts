// The workshop money model (PA-POS-38 §24.2–24.3): the checkout params (trial + immediate $97 +
// bump), the honest value math, and the off-session OTO PaymentIntent params.

import { describe, expect, it } from "vitest";
import {
  WORKSHOP_BUMP_CENTS,
  WORKSHOP_OTO1_CENTS,
  WORKSHOP_OTO2_CENTS,
  WORKSHOP_PRICE_CENTS,
  WORKSHOP_TRIAL_DAYS,
  WORKSHOP_VALUE_ITEMS,
  WORKSHOP_VALUE_TOTAL_CENTS,
  buildOtoPaymentIntentParams,
  buildWorkshopCheckoutParams,
  otoMeta,
} from "../product";

const BASE = {
  email: "buyer@example.com",
  name: "Dana",
  registrationId: "11111111-2222-3333-4444-555555555555",
  priceId: "price_pro_97",
  origin: "https://aipocketagent.com",
};

describe("workshop checkout params", () => {
  it("is a 30-day-trial subscription with the $97 workshop charged today", () => {
    const p = buildWorkshopCheckoutParams({ ...BASE, bump: false });
    expect(p.get("mode")).toBe("subscription");
    expect(p.get("line_items[0][price]")).toBe("price_pro_97");
    expect(p.get("subscription_data[trial_period_days]")).toBe(String(WORKSHOP_TRIAL_DAYS));
    expect(p.get("subscription_data[add_invoice_items][0][price_data][unit_amount]")).toBe(
      String(WORKSHOP_PRICE_CENTS),
    );
    expect(p.get("subscription_data[add_invoice_items][1][price_data][unit_amount]")).toBeNull();
  });

  it("stacks the +$27 Fast-Start bump as a second first-invoice line", () => {
    const p = buildWorkshopCheckoutParams({ ...BASE, bump: true });
    expect(p.get("subscription_data[add_invoice_items][1][price_data][unit_amount]")).toBe(
      String(WORKSHOP_BUMP_CENTS),
    );
    expect(p.get("metadata[bump_fast_start_brain_import]")).toBe("true");
  });

  it("routes the workshop session to its webhook and the subscription to the shipped provisioner", () => {
    const p = buildWorkshopCheckoutParams({ ...BASE, bump: false });
    expect(p.get("metadata[source]")).toBe("pa_workshop");
    expect(p.get("metadata[registration_id]")).toBe(BASE.registrationId);
    // The subscription rides the SHIPPED pocket_agent provisioning path (tier, account, login link).
    expect(p.get("subscription_data[metadata][source]")).toBe("pocket_agent");
    expect(p.get("subscription_data[metadata][tier]")).toBe("pro");
    expect(p.get("subscription_data[metadata][trial_source]")).toBe("workshop");
  });

  it("lands on OTO 1 after payment and back on /workshop on cancel", () => {
    const p = buildWorkshopCheckoutParams({ ...BASE, bump: false });
    expect(p.get("success_url")).toBe(
      "https://aipocketagent.com/workshop/oto/1?session={CHECKOUT_SESSION_ID}",
    );
    expect(p.get("cancel_url")).toBe("https://aipocketagent.com/workshop");
  });
});

describe("honest value math (§24.7)", () => {
  it("sums to exactly the advertised total — no inflated stack", () => {
    const sum = WORKSHOP_VALUE_ITEMS.reduce((acc, i) => acc + i.cents, 0);
    expect(sum).toBe(WORKSHOP_VALUE_TOTAL_CENTS);
    expect(WORKSHOP_VALUE_TOTAL_CENTS).toBe(19_400);
    expect(WORKSHOP_PRICE_CENTS).toBe(9_700);
  });
});

describe("OTO PaymentIntent params", () => {
  it("charges the saved payment method off-session, confirmed, no re-entry", () => {
    const p = buildOtoPaymentIntentParams({
      oto: 1,
      customerId: "cus_123",
      paymentMethodId: "pm_456",
      registrationId: BASE.registrationId,
    });
    expect(p.get("amount")).toBe(String(WORKSHOP_OTO1_CENTS));
    expect(p.get("customer")).toBe("cus_123");
    expect(p.get("payment_method")).toBe("pm_456");
    expect(p.get("off_session")).toBe("true");
    expect(p.get("confirm")).toBe("true");
    expect(p.get("metadata[oto_number]")).toBe("1");
    expect(p.get("metadata[product_slug]")).toBe("setup_sprint");
  });

  it("prices the stack per §24.3: $997 sprint, $297 pass", () => {
    expect(otoMeta(1).amountCents).toBe(99_700);
    expect(otoMeta(2).amountCents).toBe(29_700);
    expect(WORKSHOP_OTO2_CENTS).toBe(29_700);
    const p2 = buildOtoPaymentIntentParams({
      oto: 2,
      customerId: "cus_123",
      paymentMethodId: "pm_456",
      registrationId: BASE.registrationId,
    });
    expect(p2.get("amount")).toBe(String(WORKSHOP_OTO2_CENTS));
    expect(p2.get("metadata[product_slug]")).toBe("backstage_pass");
  });
});
