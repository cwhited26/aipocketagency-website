import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertReminder,
  listDueReminders,
  markReminderDelivered,
  bumpReminderRetry,
  markReminderFailed,
  listRecentReminders,
  fetchOwnerAnthropicKey,
  MAX_RETRIES,
} from "../reminders/db";

beforeEach(() => {
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => vi.restoreAllMocks());

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("insertReminder", () => {
  it("posts the schedule and returns the new id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, [{ id: "rem-1" }]));
    vi.stubGlobal("fetch", fetchMock);
    const r = await insertReminder({
      ownerId: "owner-1",
      originalCaptureId: "audit-1",
      taskText: "call the dentist",
      remindAt: new Date("2026-06-23T12:39:00.000Z"),
      sourceText: "remind me to call the dentist in 39 min",
      deliverTo: "+14158675310",
      deliverFrom: "+18005551212",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("rem-1");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent.owner_id).toBe("owner-1");
    expect(sent.deliver_to).toBe("+14158675310");
    expect(sent.deliver_from).toBe("+18005551212");
    expect(sent.remind_at).toBe("2026-06-23T12:39:00.000Z");
  });
});

describe("listDueReminders", () => {
  it("filters on pending + due + under the retry cap and returns rows", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, [
        { id: "rem-1", task_text: "x", created_at: "t", retry_count: 0, deliver_to: "+1", deliver_from: "+2" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await listDueReminders("2026-06-23T12:00:00.000Z", 50);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("delivery_status=eq.pending");
    expect(url).toContain("remind_at=lte.");
    expect(url).toContain(`retry_count=lt.${MAX_RETRIES}`);
    expect(url).toContain("order=remind_at.asc");
  });
});

describe("delivery state transitions", () => {
  it("markReminderDelivered sets status + delivered_at", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await markReminderDelivered("rem-1", "2026-06-23T12:39:01.000Z");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(init.method).toBe("PATCH");
    expect(sent.delivery_status).toBe("delivered");
    expect(sent.delivered_at).toBe("2026-06-23T12:39:01.000Z");
    expect(sent.delivery_error).toBeNull();
  });

  it("bumpReminderRetry keeps the row pending and records the error", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await bumpReminderRetry("rem-1", "twilio 500", 2);
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.delivery_status).toBe("pending");
    expect(sent.retry_count).toBe(2);
    expect(sent.delivery_error).toBe("twilio 500");
  });

  it("markReminderFailed parks the row failed", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await markReminderFailed("rem-1", "dead number", MAX_RETRIES);
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.delivery_status).toBe("failed");
    expect(sent.retry_count).toBe(MAX_RETRIES);
  });
});

describe("listRecentReminders", () => {
  it("scopes to the owner, newest-first, last 50", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await listRecentReminders("owner-1", 50);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("owner_id=eq.owner-1");
    expect(url).toContain("order=created_at.desc");
    expect(url).toContain("limit=50");
  });
});

describe("fetchOwnerAnthropicKey", () => {
  it("returns the key when present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [{ anthropic_api_key: "sk-ant-x" }])));
    expect(await fetchOwnerAnthropicKey("owner-1")).toBe("sk-ant-x");
  });
  it("returns null when the owner has none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [{ anthropic_api_key: null }])));
    expect(await fetchOwnerAnthropicKey("owner-1")).toBeNull();
  });
  it("returns null on a read failure (parser degrades to capture)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { message: "boom" })));
    expect(await fetchOwnerAnthropicKey("owner-1")).toBeNull();
  });
});
