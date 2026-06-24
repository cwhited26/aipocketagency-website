import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the collaborators the cron route pulls in. The route's own control flow (auth, send → mark,
// retry/fail thresholds, idempotency via the status filter) is what we're exercising.
vi.mock("@/lib/connectors/sms/config", () => ({
  twilioConfig: vi.fn(() => ({ accountSid: "AC", authToken: "tok" })),
}));
vi.mock("@/lib/connectors/sms/send", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/pocket-capture/reminders/db", () => ({
  MAX_RETRIES: 5,
  listDueReminders: vi.fn(),
  markReminderDelivered: vi.fn(async () => ({ ok: true, data: undefined })),
  bumpReminderRetry: vi.fn(async () => ({ ok: true, data: undefined })),
  markReminderFailed: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import { GET } from "@/app/api/cron/pocket-capture-reminders/route";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { sendSms } from "@/lib/connectors/sms/send";
import {
  listDueReminders,
  markReminderDelivered,
  bumpReminderRetry,
  markReminderFailed,
} from "@/lib/pocket-capture/reminders/db";

const sendSmsMock = vi.mocked(sendSms);
const listDueMock = vi.mocked(listDueReminders);
const twilioConfigMock = vi.mocked(twilioConfig);

function req(auth?: string): Request {
  return new Request("https://x/api/cron/pocket-capture-reminders", {
    headers: auth ? { authorization: auth } : {},
  });
}

function due(overrides: Partial<{ id: string; retry_count: number }> = {}) {
  return {
    id: overrides.id ?? "rem-1",
    task_text: "call the dentist",
    created_at: "2026-06-23T12:00:00.000Z",
    retry_count: overrides.retry_count ?? 0,
    deliver_to: "+14158675310",
    deliver_from: "+18005551212",
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  twilioConfigMock.mockReturnValue({ accountSid: "AC", authToken: "tok" });
});

afterEach(() => vi.clearAllMocks());

describe("reminders cron auth", () => {
  it("401s without the cron secret", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});

describe("reminders cron — twilio not configured", () => {
  it("soft-skips, leaving rows pending", async () => {
    twilioConfigMock.mockReturnValueOnce(null);
    const res = await GET(req("Bearer secret"));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, skipped: "twilio_not_configured" });
    expect(listDueMock).not.toHaveBeenCalled();
  });
});

describe("reminders cron — delivery", () => {
  it("sends a due reminder then marks it delivered", async () => {
    listDueMock.mockResolvedValueOnce({ ok: true, data: [due()] });
    sendSmsMock.mockResolvedValueOnce({ ok: true, data: { segmentsSent: 1 } });

    const res = await GET(req("Bearer secret"));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, delivered: 1, retried: 0, failed: 0 });
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const [, args] = sendSmsMock.mock.calls[0];
    expect(args).toMatchObject({ from: "+18005551212", to: "+14158675310" });
    expect(args.body).toContain("Reminder: call the dentist");
    expect(markReminderDelivered).toHaveBeenCalledWith("rem-1", expect.any(String));
  });

  it("is idempotent: a delivered reminder isn't re-swept", async () => {
    // First sweep delivers it; second sweep's query no longer returns it (status flipped).
    listDueMock.mockResolvedValueOnce({ ok: true, data: [due()] });
    sendSmsMock.mockResolvedValueOnce({ ok: true, data: { segmentsSent: 1 } });
    await GET(req("Bearer secret"));

    listDueMock.mockResolvedValueOnce({ ok: true, data: [] });
    const res = await GET(req("Bearer secret"));
    const body = await res.json();
    expect(body).toMatchObject({ delivered: 0, due: 0 });
    expect(sendSmsMock).toHaveBeenCalledTimes(1); // not sent twice
  });

  it("bumps retry (keeps pending) on a send failure below the cap", async () => {
    listDueMock.mockResolvedValueOnce({ ok: true, data: [due({ retry_count: 1 })] });
    sendSmsMock.mockResolvedValueOnce({ ok: false, status: 500, error: "twilio down" });

    const res = await GET(req("Bearer secret"));
    const body = await res.json();
    expect(body).toMatchObject({ delivered: 0, retried: 1, failed: 0 });
    expect(bumpReminderRetry).toHaveBeenCalledWith("rem-1", "twilio down", 2);
    expect(markReminderFailed).not.toHaveBeenCalled();
  });

  it("parks the reminder failed once it hits the retry cap", async () => {
    listDueMock.mockResolvedValueOnce({ ok: true, data: [due({ retry_count: 4 })] });
    sendSmsMock.mockResolvedValueOnce({ ok: false, status: 500, error: "dead number" });

    const res = await GET(req("Bearer secret"));
    const body = await res.json();
    expect(body).toMatchObject({ delivered: 0, retried: 0, failed: 1 });
    expect(markReminderFailed).toHaveBeenCalledWith("rem-1", "dead number", 5);
  });
});
