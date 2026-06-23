import { describe, it, expect } from "vitest";
import { buildPocketCaptureCheckoutParams } from "../checkout";
import {
  POCKET_CAPTURE_ADDON_KIND,
  POCKET_CAPTURE_CANCEL_PATH,
  POCKET_CAPTURE_CHECKOUT_SOURCE,
  POCKET_CAPTURE_PRICE_CENTS,
  POCKET_CAPTURE_PRODUCT_NAME,
} from "../product";

describe("Pocket Capture product facts", () => {
  it("prices the standalone SKU at $47 one-time", () => {
    expect(POCKET_CAPTURE_PRICE_CENTS).toBe(4_700);
  });

  it("uses a distinct metadata source + ledger kind so flows never cross-fire", () => {
    expect(POCKET_CAPTURE_CHECKOUT_SOURCE).toBe("pocket_capture_standalone");
    expect(POCKET_CAPTURE_ADDON_KIND).toBe("pocket_capture_standalone");
    expect(POCKET_CAPTURE_CHECKOUT_SOURCE).not.toBe("pocket_agent_addon");
    expect(POCKET_CAPTURE_CHECKOUT_SOURCE).not.toBe("pocket_agent");
  });

  it("cancels back to the standalone landing page", () => {
    expect(POCKET_CAPTURE_CANCEL_PATH).toBe("/capture");
  });
});

describe("buildPocketCaptureCheckoutParams", () => {
  const base = { origin: "https://aipocketagent.com", email: "buyer@example.com" };

  it("builds a one-time charge with an inline $47 price", () => {
    const p = buildPocketCaptureCheckoutParams({ ...base, userId: null });
    expect(p.get("mode")).toBe("payment");
    expect(p.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(p.get("line_items[0][price_data][unit_amount]")).toBe(String(POCKET_CAPTURE_PRICE_CENTS));
    expect(p.get("line_items[0][price_data][product_data][name]")).toBe(POCKET_CAPTURE_PRODUCT_NAME);
    expect(p.get("line_items[0][quantity]")).toBe("1");
  });

  it("always collects the buyer email and stamps source on session + payment intent", () => {
    const p = buildPocketCaptureCheckoutParams({ ...base, userId: null });
    expect(p.get("customer_email")).toBe("buyer@example.com");
    expect(p.get("metadata[source]")).toBe(POCKET_CAPTURE_CHECKOUT_SOURCE);
    expect(p.get("metadata[email]")).toBe("buyer@example.com");
    expect(p.get("payment_intent_data[metadata][source]")).toBe(POCKET_CAPTURE_CHECKOUT_SOURCE);
    expect(p.get("payment_intent_data[metadata][email]")).toBe("buyer@example.com");
  });

  it("routes success to /capture/welcome carrying the Stripe session id, cancel to /capture", () => {
    const p = buildPocketCaptureCheckoutParams({ ...base, userId: null });
    expect(p.get("success_url")).toBe(
      "https://aipocketagent.com/capture/welcome?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.get("cancel_url")).toBe("https://aipocketagent.com/capture");
  });

  it("threads user_id into client_reference_id + metadata only when signed in", () => {
    const guest = buildPocketCaptureCheckoutParams({ ...base, userId: null });
    expect(guest.get("client_reference_id")).toBeNull();
    expect(guest.get("metadata[user_id]")).toBeNull();

    const signedIn = buildPocketCaptureCheckoutParams({ ...base, userId: "user-7" });
    expect(signedIn.get("client_reference_id")).toBe("user-7");
    expect(signedIn.get("metadata[user_id]")).toBe("user-7");
  });

  it("is deterministic — the same input yields identical params (idempotent session creation)", () => {
    const a = buildPocketCaptureCheckoutParams({ ...base, userId: "user-7" }).toString();
    const b = buildPocketCaptureCheckoutParams({ ...base, userId: "user-7" }).toString();
    expect(a).toBe(b);
  });
});
