import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPocketCaptureUser } from "../entitlement";

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

describe("isPocketCaptureUser", () => {
  it("returns true when a ledger row exists", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, [{ id: "row-1" }]));
    const res = await isPocketCaptureUser({ userId: "u1", email: "buyer@example.com" });
    expect(res).toEqual({ ok: true, data: true });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("kind=eq.pocket_capture_standalone");
    // Matches on user_id OR email (PostgREST embedded-OR dot syntax).
    expect(url).toContain("or=(");
    expect(url).toContain("user_id.eq.u1");
    expect(url).toContain("email.eq.buyer%40example.com");
  });

  it("returns false when no ledger row exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, []));
    const res = await isPocketCaptureUser({ userId: "u1", email: "nobody@example.com" });
    expect(res).toEqual({ ok: true, data: false });
  });

  it("lowercases the email and omits it from the OR when absent", async () => {
    // Fresh Response per call — a Response body can only be read once.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse(200, []));
    await isPocketCaptureUser({ userId: "u1", email: "MixedCase@Example.com" });
    let url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("email.eq.mixedcase%40example.com");

    fetchSpy.mockClear();
    await isPocketCaptureUser({ userId: "u1", email: null });
    url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("user_id.eq.u1");
    expect(url).not.toContain("email.eq.");
  });

  it("surfaces an infrastructure error (ok:false) rather than guessing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(500, "boom"));
    const res = await isPocketCaptureUser({ userId: "u1", email: null });
    expect(res.ok).toBe(false);
  });

  it("errors when service-role env is missing", async () => {
    delete process.env.POCKET_AGENT_SUPABASE_URL;
    delete process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.WC_ADMIN_SUPABASE_URL;
    delete process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
    const res = await isPocketCaptureUser({ userId: "u1", email: null });
    expect(res.ok).toBe(false);
  });
});
