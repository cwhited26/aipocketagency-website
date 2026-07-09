// POST /api/waitlist/ghl-agency end to end with stubbed network: a valid submission upserts the
// pa_ghl_agency_waitlist row (PostgREST, on_conflict=email) and emails Chase via Resend; invalid
// payloads 400; one IP hammering the endpoint 429s. The rate-limit store is module-scoped, so
// every test uses its own IP.

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { MAX_PER_WINDOW } from "@/lib/ghl-waitlist/rate-limit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const ROW = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: null,
  name: "Janie",
  email: "janie@example.com",
  agency_name: "Villers Media",
  client_count: 12,
  top_frustration: "Same funnel built 30 times.",
  referrer: null,
  created_at: "2026-07-08T12:00:00.000Z",
};

function stubNetwork({ insertStatus = 201 }: { insertStatus?: number } = {}) {
  const calls: Array<{ url: string; body: string | null }> = [];
  vi.stubEnv("POCKET_AGENT_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("POCKET_AGENT_SUPABASE_SERVICE_KEY", "service-key");
  vi.stubEnv("RESEND_API_KEY", "re_test_x");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : null });
      if (url.includes("/rest/v1/pa_ghl_agency_waitlist")) {
        if (insertStatus !== 201) return new Response("boom", { status: insertStatus });
        return new Response(JSON.stringify([ROW]), { status: 201 });
      }
      if (url.includes("api.resend.com/emails")) {
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
  return calls;
}

function makeRequest(body: unknown, ip: string): Request {
  return new Request("https://aipocketagent.com/api/waitlist/ghl-agency", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
}

const VALID = {
  name: "Janie",
  email: "janie@example.com",
  agencyName: "Villers Media",
  clientCount: "12",
  topFrustration: "Same funnel built 30 times.",
  referrer: "",
};

describe("POST /api/waitlist/ghl-agency", () => {
  it("persists the entry and emails Chase on a valid submission", async () => {
    const calls = stubNetwork();
    const res = await POST(makeRequest(VALID, "10.0.0.1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const insert = calls.find((c) => c.url.includes("pa_ghl_agency_waitlist"));
    expect(insert).toBeDefined();
    expect(insert?.url).toContain("on_conflict=email");
    const insertBody = JSON.parse(insert?.body ?? "{}") as Record<string, unknown>;
    expect(insertBody).toMatchObject({
      email: "janie@example.com",
      agency_name: "Villers Media",
      client_count: 12,
      owner_id: null,
    });

    const email = calls.find((c) => c.url.includes("api.resend.com"));
    expect(email).toBeDefined();
    const emailBody = JSON.parse(email?.body ?? "{}") as {
      from: string;
      to: string[];
      subject: string;
    };
    expect(emailBody.from).toBe("chase@aipocketagent.com");
    expect(emailBody.to).toEqual(["chase@aipocketagent.com"]);
    expect(emailBody.subject).toBe("[GHL Waitlist] Villers Media — 12 clients");
  });

  it("still succeeds when the notification email fails", async () => {
    const calls = stubNetwork();
    vi.stubEnv("RESEND_API_KEY", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const res = await POST(makeRequest(VALID, "10.0.0.2"));
      expect(res.status).toBe(200);
      expect(calls.some((c) => c.url.includes("pa_ghl_agency_waitlist"))).toBe(true);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("400s on a malformed body", async () => {
    stubNetwork();
    const res = await POST(
      new Request("https://aipocketagent.com/api/waitlist/ghl-agency", {
        method: "POST",
        headers: { "x-real-ip": "10.0.0.3" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400s on an invalid payload without touching the network", async () => {
    const calls = stubNetwork();
    const res = await POST(makeRequest({ ...VALID, email: "nope" }, "10.0.0.4"));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("503s when the insert fails", async () => {
    stubNetwork({ insertStatus: 500 });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const res = await POST(makeRequest(VALID, "10.0.0.5"));
      expect(res.status).toBe(503);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("429s one IP after the window fills, with a Retry-After header", async () => {
    stubNetwork();
    const ip = "10.0.0.6";
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      const res = await POST(makeRequest(VALID, ip));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(makeRequest(VALID, ip));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    // A different IP is unaffected.
    const other = await POST(makeRequest(VALID, "10.0.0.7"));
    expect(other.status).toBe(200);
  });
});
