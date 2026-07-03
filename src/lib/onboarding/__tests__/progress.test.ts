// PA-POS-36 award-path pins: a fresh detection awards the step bonus at a credit tier only, a
// repeat detection is a hard no-op, the sixth step stacks the completion bonus, and every award
// rides the pa_top_up_purchases idempotency key — so a retried hook can never double-grant. The
// progress-table REST layer is stubbed at global fetch; the metering seams are module mocks.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingStepSlug } from "@/data/onboarding-steps";

vi.mock("@/lib/personas/tier-caps", () => ({
  getCurrentTier: vi.fn(),
}));
vi.mock("@/lib/metering/allowance", () => ({
  getCreditStatus: vi.fn(),
}));
vi.mock("@/lib/metering/store", () => ({
  insertTopUpPurchase: vi.fn(),
}));

import { getCurrentTier } from "@/lib/personas/tier-caps";
import { getCreditStatus } from "@/lib/metering/allowance";
import { insertTopUpPurchase } from "@/lib/metering/store";
import { markOnboardingStepComplete, onboardingBonusSessionKey } from "../progress";

const OWNER = "11111111-2222-3333-4444-555555555555";

type FetchCall = { url: string; method: string; body: string | null };

let fetchCalls: FetchCall[];
/** Queue of JSON payloads the stubbed fetch returns, in call order. */
let responses: unknown[];

function stubFetch() {
  fetchCalls = [];
  responses = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      const payload = responses.shift() ?? [];
      return new Response(JSON.stringify(payload), { status: 200 });
    }),
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  vi.mocked(getCurrentTier).mockReset();
  vi.mocked(getCreditStatus).mockReset().mockResolvedValue(null);
  vi.mocked(insertTopUpPurchase).mockReset().mockResolvedValue({ ok: true });
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function completedRows(slugs: OnboardingStepSlug[]): unknown {
  return slugs.map((s) => ({
    step_slug: s,
    completed_at: "2026-07-03T00:00:00Z",
    credits_awarded: false,
  }));
}

describe("markOnboardingStepComplete", () => {
  it("awards the step bonus on a fresh completion at a credit tier", async () => {
    vi.mocked(getCurrentTier).mockResolvedValue("studio_plus");
    responses = [
      [{ step_slug: "connect_tool" }], // insert echoes the new row
      [], // credits_awarded PATCH (return=minimal)
      completedRows(["connect_tool"]), // completion count read
    ];

    await markOnboardingStepComplete(OWNER, "connect_tool");

    expect(getCreditStatus).toHaveBeenCalledWith(OWNER, { tier: "studio_plus" });
    expect(insertTopUpPurchase).toHaveBeenCalledTimes(1);
    expect(insertTopUpPurchase).toHaveBeenCalledWith({
      ownerId: OWNER,
      stripeSessionId: onboardingBonusSessionKey(OWNER, "connect_tool"),
      creditsAdded: 50,
      amountPaidCents: 0,
      source: "onboarding_bonus",
    });
    const patch = fetchCalls.find((c) => c.method === "PATCH");
    expect(patch?.body).toContain('"credits_awarded":true');
  });

  it("is a hard no-op when the step is already complete", async () => {
    vi.mocked(getCurrentTier).mockResolvedValue("studio_plus");
    responses = [[]]; // ignore-duplicates conflict → empty echo

    await markOnboardingStepComplete(OWNER, "connect_tool");

    expect(getCurrentTier).not.toHaveBeenCalled();
    expect(insertTopUpPurchase).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(1);
  });

  it("records progress without any credit surface at an entry tier", async () => {
    vi.mocked(getCurrentTier).mockResolvedValue("starter");
    responses = [
      [{ step_slug: "set_up_ritual" }],
      completedRows(["set_up_ritual"]),
    ];

    await markOnboardingStepComplete(OWNER, "set_up_ritual");

    expect(getCreditStatus).not.toHaveBeenCalled();
    expect(insertTopUpPurchase).not.toHaveBeenCalled();
    expect(fetchCalls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("stacks the completion bonus when the sixth step lands", async () => {
    vi.mocked(getCurrentTier).mockResolvedValue("enterprise");
    responses = [
      [{ step_slug: "invite_teammate" }],
      [], // credits_awarded PATCH
      completedRows([
        "connect_tool",
        "compose_agent",
        "approve_inbox",
        "name_persona",
        "set_up_ritual",
        "invite_teammate",
      ]),
    ];

    await markOnboardingStepComplete(OWNER, "invite_teammate");

    expect(insertTopUpPurchase).toHaveBeenCalledTimes(2);
    expect(insertTopUpPurchase).toHaveBeenLastCalledWith({
      ownerId: OWNER,
      stripeSessionId: onboardingBonusSessionKey(OWNER, "complete"),
      creditsAdded: 250,
      amountPaidCents: 0,
      source: "onboarding_bonus",
    });
  });

  it("never throws when the table write fails (pre-migration fail-closed)", async () => {
    vi.mocked(getCurrentTier).mockResolvedValue("studio_plus");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("relation does not exist", { status: 404 })),
    );

    await expect(markOnboardingStepComplete(OWNER, "connect_tool")).resolves.toBeUndefined();
    expect(insertTopUpPurchase).not.toHaveBeenCalled();
  });
});
