import { describe, it, expect } from "vitest";
import { buildPocketAgentCheckoutParams } from "@/lib/pocket-agent-checkout";

const base = {
  email: "owner@example.com",
  name: "Dana",
  tier: "pro" as const,
  priceId: "price_test",
  origin: "https://start.aipocketagent.com",
  userId: null,
};

describe("buildPocketAgentCheckoutParams — funnel mode", () => {
  it("routes success/cancel back onto the funnel and stamps attribution", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      funnel: true,
      funnelAnswers: "1.2.0.1.1",
    });
    expect(p.get("success_url")).toBe(
      "https://start.aipocketagent.com/success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.get("cancel_url")).toBe("https://start.aipocketagent.com/start");
    expect(p.get("metadata[funnel_source]")).toBe("launch_funnel");
    expect(p.get("metadata[funnel_answers]")).toBe("1.2.0.1.1");
    // Cold funnel has no account — answers stand in for client_reference_id.
    expect(p.get("client_reference_id")).toBe("funnel:1.2.0.1.1");
  });

  it("leaves the standard (non-funnel) flow untouched", () => {
    const p = buildPocketAgentCheckoutParams(base);
    expect(p.get("success_url")).toBe(
      "https://start.aipocketagent.com/upsell?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.get("cancel_url")).toBe("https://start.aipocketagent.com/pricing");
    expect(p.get("metadata[funnel_source]")).toBeNull();
    expect(p.get("client_reference_id")).toBeNull();
  });

  it("a signed-in user's id still wins over the funnel attribution handle", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      userId: "user-123",
      funnel: true,
      funnelAnswers: "0.0",
    });
    expect(p.get("client_reference_id")).toBe("user-123");
    expect(p.get("metadata[funnel_source]")).toBe("launch_funnel");
  });
});
