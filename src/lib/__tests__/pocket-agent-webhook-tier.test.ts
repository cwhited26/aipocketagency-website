import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PocketAgentSubscriptionRow } from "@/lib/pocket-agent-supabase";

// Mock the Supabase data layer so we can assert what the webhook tries to write without
// any network. Every function the tier path touches is a spy.
const mocks = vi.hoisted(() => ({
  fetchPocketAgentBySubscriptionId: vi.fn(),
  markPocketAgentTier: vi.fn(),
  upsertPocketAgentTrial: vi.fn(),
  setPocketAgentAddonByCustomer: vi.fn(),
}));

vi.mock("@/lib/pocket-agent-supabase", () => ({
  fetchPocketAgentBySubscriptionId: mocks.fetchPocketAgentBySubscriptionId,
  markPocketAgentTier: mocks.markPocketAgentTier,
  upsertPocketAgentTrial: mocks.upsertPocketAgentTrial,
  setPocketAgentAddonByCustomer: mocks.setPocketAgentAddonByCustomer,
  // Unused by the tier path but imported by the route module.
  fetchPocketAgentByCustomerId: vi.fn(),
  markPocketAgentActive: vi.fn(),
  markPocketAgentCanceled: vi.fn(),
  markPocketAgentTrialEndNotified: vi.fn(),
  markWelcomeEmailSent: vi.fn(),
}));

import { applyPocketAgentTierFromSubscription } from "@/lib/pocket-agent-webhook-tier";

const PRO_PRICE = "price_1TfRbIJ6S5nx9HK5sucoD8sB";
const STUDIO_PRICE = "price_1TfRbKJ6S5nx9HK5g3U1yYOK";

function subscription(over: {
  id?: string;
  customer?: string | null;
  priceIds?: string[];
  metadata?: Record<string, string> | null;
}) {
  return {
    id: over.id ?? "sub_test",
    customer: over.customer === undefined ? "cus_test" : over.customer,
    status: "trialing",
    trial_start: null,
    trial_end: null,
    metadata: over.metadata ?? null,
    items: {
      data: (over.priceIds ?? [PRO_PRICE]).map((id) => ({ price: { id } })),
    },
  };
}

function row(over: Partial<PocketAgentSubscriptionRow> = {}): PocketAgentSubscriptionRow {
  return {
    id: "row_1",
    user_id: "user_1",
    email: "owner@example.com",
    name: "Chase",
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    stripe_session_id: null,
    status: "trial",
    tier: null,
    addon_sync: false,
    addon_publish: false,
    trial_started_at: null,
    trial_ends_at: null,
    trial_end_reminder_sent_at: null,
    welcome_email_sent_at: null,
    activated_at: null,
    canceled_at: null,
    email_sequence_state: {},
    created_at: "2026-06-05T00:00:00Z",
    updated_at: "2026-06-05T00:00:00Z",
    ...over,
  };
}

describe("applyPocketAgentTierFromSubscription — new /start?tier= metadata flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markPocketAgentTier.mockResolvedValue({ ok: true });
    mocks.upsertPocketAgentTrial.mockResolvedValue({ ok: true });
    mocks.setPocketAgentAddonByCustomer.mockResolvedValue({ ok: true });
  });

  it("writes the tier when the /start row already exists (no on-the-fly creation)", async () => {
    mocks.fetchPocketAgentBySubscriptionId.mockResolvedValue({ ok: true, row: row() });

    await applyPocketAgentTierFromSubscription(
      subscription({
        priceIds: [PRO_PRICE],
        metadata: { source: "pocket_agent", tier: "pro", email: "owner@example.com" },
      }),
      "created",
    );

    expect(mocks.upsertPocketAgentTrial).not.toHaveBeenCalled();
    expect(mocks.markPocketAgentTier).toHaveBeenCalledWith("sub_test", "pro");
  });

  it("is a no-op when the row already carries the resolved tier", async () => {
    mocks.fetchPocketAgentBySubscriptionId.mockResolvedValue({
      ok: true,
      row: row({ tier: "pro" }),
    });

    await applyPocketAgentTierFromSubscription(
      subscription({ priceIds: [PRO_PRICE], metadata: { tier: "pro" } }),
      "updated",
    );

    expect(mocks.markPocketAgentTier).not.toHaveBeenCalled();
  });

  it("prefers the price-derived tier over a conflicting metadata.tier", async () => {
    mocks.fetchPocketAgentBySubscriptionId.mockResolvedValue({ ok: true, row: row() });

    await applyPocketAgentTierFromSubscription(
      subscription({
        priceIds: [STUDIO_PRICE], // studio
        metadata: { tier: "pro" }, // stale/wrong hint
      }),
      "updated",
    );

    expect(mocks.markPocketAgentTier).toHaveBeenCalledWith("sub_test", "studio");
  });
});

describe("applyPocketAgentTierFromSubscription — defense-in-depth (legacy payment-link path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markPocketAgentTier.mockResolvedValue({ ok: true });
    mocks.upsertPocketAgentTrial.mockResolvedValue({ ok: true });
    mocks.setPocketAgentAddonByCustomer.mockResolvedValue({ ok: true });
  });

  it("creates the row on the fly + writes the tier when none exists but metadata is present", async () => {
    mocks.fetchPocketAgentBySubscriptionId.mockResolvedValue({ ok: true, row: null });

    await applyPocketAgentTierFromSubscription(
      subscription({
        id: "sub_link",
        customer: "cus_link",
        priceIds: [STUDIO_PRICE],
        metadata: { email: "buyer@example.com", name: "Pat", user_id: "user_9" },
      }),
      "created",
    );

    expect(mocks.upsertPocketAgentTrial).toHaveBeenCalledTimes(1);
    const arg = mocks.upsertPocketAgentTrial.mock.calls[0][0];
    expect(arg).toMatchObject({
      email: "buyer@example.com",
      name: "Pat",
      userId: "user_9",
      stripeCustomerId: "cus_link",
      stripeSubscriptionId: "sub_link",
    });
    expect(mocks.markPocketAgentTier).toHaveBeenCalledWith("sub_link", "studio");
  });

  it("does NOT create a row (stays an unprovisionable blocker) when metadata lacks email", async () => {
    mocks.fetchPocketAgentBySubscriptionId.mockResolvedValue({ ok: true, row: null });

    await applyPocketAgentTierFromSubscription(
      subscription({ priceIds: [PRO_PRICE], metadata: null }),
      "created",
    );

    expect(mocks.upsertPocketAgentTrial).not.toHaveBeenCalled();
    expect(mocks.markPocketAgentTier).not.toHaveBeenCalled();
  });
});
