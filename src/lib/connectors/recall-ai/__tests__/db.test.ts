// Unit test for webhook idempotency (MP-CORE-1): recordWebhookEvent claims the event_id; a
// re-delivery (UNIQUE violation) must return firstDelivery=false so the route skips reprocessing.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordWebhookEvent } from "../db";

beforeEach(() => {
  process.env.POCKET_AGENT_SUPABASE_URL = "https://pa.example.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "service-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const EVENT = {
  eventId: "msg_dedupe_1",
  recallBotId: "bot_1",
  eventType: "transcript.done",
  payload: { event: "transcript.done" },
  signatureVerified: true,
};

describe("recordWebhookEvent idempotency", () => {
  it("returns firstDelivery=true on the first insert", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    const res = await recordWebhookEvent(EVENT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.firstDelivery).toBe(true);
  });

  it("returns firstDelivery=false on a duplicate (23505)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }),
            { status: 409 },
          ),
      ),
    );
    const res = await recordWebhookEvent(EVENT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.firstDelivery).toBe(false);
  });

  it("surfaces a real DB error (not a unique violation)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const res = await recordWebhookEvent(EVENT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(500);
  });
});
