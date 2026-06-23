import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveTwilioNumber,
  insertTwilioNumber,
  lookupCaptureOwnerByTwilioNumber,
} from "../sms-numbers";

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

describe("getActiveTwilioNumber", () => {
  it("returns the active number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, [{ twilio_phone_number: "+1555", twilio_phone_sid: "PN1" }])),
    );
    const r = await getActiveTwilioNumber("owner-1");
    expect(r).toEqual({ ok: true, data: { phoneNumber: "+1555", phoneSid: "PN1" } });
  });

  it("returns null when the owner has no number", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));
    const r = await getActiveTwilioNumber("owner-1");
    expect(r).toEqual({ ok: true, data: null });
  });

  it("queries only active (released_at IS NULL) rows", async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await getActiveTwilioNumber("owner-1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("released_at=is.null");
  });
});

describe("insertTwilioNumber", () => {
  it("treats the active-owner UNIQUE collision as a duplicate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, { code: "23505" })));
    const r = await insertTwilioNumber({ ownerId: "o", phoneNumber: "+1", phoneSid: "PN" });
    expect(r).toEqual({ ok: true, data: { duplicate: true } });
  });
});

describe("lookupCaptureOwnerByTwilioNumber — owner resolution", () => {
  it("resolves a number to its owner + brain credentials", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("pa_pocket_capture_twilio_numbers")) {
        return jsonResponse(200, [{ owner_id: "owner-7" }]);
      }
      return jsonResponse(200, [{ id: "owner-7", brain_repo: "user/brain", github_token: "ghtok" }]);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const r = await lookupCaptureOwnerByTwilioNumber("+18005551212");
    expect(r).toEqual({ ok: true, data: { id: "owner-7", brain_repo: "user/brain", github_token: "ghtok" } });
    // First read hits the numbers table; second hits pocket_agent_users.
    expect(String(fetchMock.mock.calls[0][0])).toContain("pa_pocket_capture_twilio_numbers");
    expect(String(fetchMock.mock.calls[1][0])).toContain("pocket_agent_users");
  });

  it("returns null for an unrecognized number (no second query)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);
    const r = await lookupCaptureOwnerByTwilioNumber("+1999");
    expect(r).toEqual({ ok: true, data: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
