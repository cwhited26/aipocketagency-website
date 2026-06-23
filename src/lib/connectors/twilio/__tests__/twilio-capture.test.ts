// Unit tests for the Pocket Capture Twilio lane (PC-CORE-3): the capture webhook URLs, the
// signature wrapper (positive + negative), area-code normalization, the purchase-body builder, and
// provisionTwilioNumber's idempotency (existing number → no purchase) + buy-and-persist path.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureSmsWebhookUrl, captureVoiceNoopUrl } from "../config";
import { verifyCaptureSmsSignature } from "../signature";
import { computeTwilioSignature } from "@/lib/connectors/sms/signature";
import { normalizeAreaCode, buildPurchaseBody, provisionTwilioNumber } from "../provision";

beforeEach(() => {
  process.env.PA_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";
  process.env.PA_TWILIO_ACCOUNT_SID = "AC_test";
  process.env.PA_TWILIO_AUTH_TOKEN = "tok_test";
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("capture webhook URLs", () => {
  it("derive from PA_OAUTH_REDIRECT_BASE, distinct from the Channels Gateway inbound URL", () => {
    expect(captureSmsWebhookUrl()).toBe("https://aipocketagent.com/api/webhooks/twilio-sms-capture");
    expect(captureVoiceNoopUrl()).toBe("https://aipocketagent.com/api/webhooks/twilio-sms-capture/voice");
  });

  it("trims trailing slashes on the base", () => {
    process.env.PA_OAUTH_REDIRECT_BASE = "https://example.com/";
    expect(captureSmsWebhookUrl()).toBe("https://example.com/api/webhooks/twilio-sms-capture");
  });
});

describe("verifyCaptureSmsSignature", () => {
  const params = { From: "+14158675310", To: "+18005551212", Body: "save this", MessageSid: "SM1" };

  it("accepts a signature computed over the canonical capture URL", () => {
    const sig = computeTwilioSignature("tok_test", captureSmsWebhookUrl(), params);
    expect(verifyCaptureSmsSignature(params, sig)).toEqual({ ok: true });
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const sig = computeTwilioSignature("tok_test", captureSmsWebhookUrl(), params);
    const result = verifyCaptureSmsSignature({ ...params, Body: "different" }, sig);
    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a missing signature header", () => {
    expect(verifyCaptureSmsSignature(params, null)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("reports not-configured when Twilio creds are absent (fails closed)", () => {
    delete process.env.PA_TWILIO_ACCOUNT_SID;
    delete process.env.PA_TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(verifyCaptureSmsSignature(params, "anything")).toEqual({ ok: false, reason: "not-configured" });
  });
});

describe("normalizeAreaCode", () => {
  it("accepts a bare NPA", () => expect(normalizeAreaCode("415")).toBe("415"));
  it("extracts from a 10-digit number", () => expect(normalizeAreaCode("4158675310")).toBe("415"));
  it("extracts from an 11-digit +1 number", () => expect(normalizeAreaCode("+1 (415) 867-5310")).toBe("415"));
  it("returns null for junk", () => expect(normalizeAreaCode("hello")).toBeNull());
  it("returns null for empty", () => expect(normalizeAreaCode(null)).toBeNull());
});

describe("buildPurchaseBody", () => {
  it("wires both webhooks and includes the area code when given", () => {
    const body = buildPurchaseBody("415");
    expect(body.get("SmsUrl")).toBe(captureSmsWebhookUrl());
    expect(body.get("VoiceUrl")).toBe(captureVoiceNoopUrl());
    expect(body.get("SmsMethod")).toBe("POST");
    expect(body.get("AreaCode")).toBe("415");
  });

  it("omits the area code for a national-pool purchase", () => {
    expect(buildPurchaseBody(null).has("AreaCode")).toBe(false);
  });
});

describe("provisionTwilioNumber — idempotency", () => {
  it("returns the existing active number without buying", async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      jsonResponse(200, [{ twilio_phone_number: "+15551230001", twilio_phone_sid: "PN_existing" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await provisionTwilioNumber({ ownerId: "owner-1" });
    expect(r).toEqual({ ok: true, phoneNumber: "+15551230001", phoneSid: "PN_existing", existed: true });
    // Only the active-number read — never a Twilio IncomingPhoneNumbers POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes("IncomingPhoneNumbers"))).toBe(true);
  });

  it("buys + persists a number when none exists", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/rest/v1/pa_pocket_capture_twilio_numbers") && (init?.method ?? "GET") === "GET") {
        return jsonResponse(200, []); // no active number
      }
      if (url.includes("IncomingPhoneNumbers.json")) {
        return jsonResponse(201, { sid: "PN_new", phone_number: "+15557654321" });
      }
      // The persist insert.
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const r = await provisionTwilioNumber({ ownerId: "owner-2", areaCode: "555" });
    expect(r).toEqual({ ok: true, phoneNumber: "+15557654321", phoneSid: "PN_new", existed: false });
    expect(calls.some((c) => c.includes("IncomingPhoneNumbers.json"))).toBe(true);
  });

  it("returns a soft 501 when Twilio is not configured", async () => {
    delete process.env.PA_TWILIO_ACCOUNT_SID;
    delete process.env.PA_TWILIO_AUTH_TOKEN;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, []))); // no active number
    const r = await provisionTwilioNumber({ ownerId: "owner-3" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(501);
  });
});
