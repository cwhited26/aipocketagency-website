import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimInboundDelivery, markProcessed, releaseInboundClaim } from "../log";

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

describe("claimInboundDelivery — idempotency", () => {
  it("claims a fresh delivery and returns the row id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, [{ id: "row-1" }])));
    const r = await claimInboundDelivery({
      ownerId: "owner-1",
      fromEmail: "a@b.com",
      subject: "hi",
      dedupKey: "msg-123",
    });
    expect(r.ok).toBe(true);
    if (r.ok && !r.duplicate) expect(r.id).toBe("row-1");
  });

  it("treats a 23505 dedup_key collision as a duplicate (no re-capture)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(409, { code: "23505", message: "duplicate key value violates unique constraint" })),
    );
    const r = await claimInboundDelivery({
      ownerId: "owner-1",
      fromEmail: "a@b.com",
      subject: "hi",
      dedupKey: "msg-123",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.duplicate).toBe(true);
  });

  it("surfaces a non-duplicate write failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { message: "boom" })));
    const r = await claimInboundDelivery({ ownerId: null, fromEmail: "", subject: null, dedupKey: "k" });
    expect(r.ok).toBe(false);
  });
});

describe("markProcessed / releaseInboundClaim", () => {
  it("PATCHes the row processed=true", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await markProcessed("row-1");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });

  it("DELETEs the claim on release", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await releaseInboundClaim("row-1");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});
