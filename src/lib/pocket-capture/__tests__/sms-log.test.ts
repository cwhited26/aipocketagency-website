import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimSmsDelivery, markProcessed, markError, releaseSmsClaim } from "../sms-log";

beforeEach(() => {
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const base = {
  ownerId: "owner-1",
  fromNumber: "+14158675310",
  toNumber: "+18005551212",
  messageSid: "SM_123",
  messageBody: "hi",
  mediaUrls: [] as string[],
};

describe("claimSmsDelivery — message_sid idempotency", () => {
  it("claims a fresh delivery and returns the row id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, [{ id: "row-1" }])));
    const r = await claimSmsDelivery(base);
    expect(r.ok).toBe(true);
    if (r.ok && !r.duplicate) expect(r.id).toBe("row-1");
  });

  it("treats a 23505 message_sid collision as a duplicate (no re-capture)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(409, { code: "23505", message: "duplicate key value violates unique constraint" }),
      ),
    );
    const r = await claimSmsDelivery(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.duplicate).toBe(true);
  });

  it("sends owner_id, message_sid, and media_urls on the insert", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, [{ id: "row-9" }]));
    vi.stubGlobal("fetch", fetchMock);
    await claimSmsDelivery({ ...base, mediaUrls: ["https://api.twilio.com/m/0"] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent.owner_id).toBe("owner-1");
    expect(sent.message_sid).toBe("SM_123");
    expect(sent.media_urls).toEqual(["https://api.twilio.com/m/0"]);
  });

  it("surfaces a non-duplicate write failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { message: "boom" })));
    const r = await claimSmsDelivery({ ...base, ownerId: null });
    expect(r.ok).toBe(false);
  });
});

describe("markProcessed / markError / releaseSmsClaim", () => {
  it("PATCHes processed=true", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await markProcessed("row-1");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });

  it("records an error reason", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await markError("row-1", "no brain connected");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).error_text).toBe("no brain connected");
  });

  it("DELETEs the row on release", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await releaseSmsClaim("row-1");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});
