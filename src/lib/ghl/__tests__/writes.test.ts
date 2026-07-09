// The write path's contract: Zod payloads, the approval gate (staged always, generic
// auto-approve unreachable), multi-tenant enforcement at execute time, and the tier/pass gate.
// Store + oauth + client are mocked — no DB, no network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  stageConnectorActionMock,
  fetchSyncedLocationMock,
  fetchGhlConnectionFullMock,
  insertGhlActionLogMock,
  resolveGhlAccessMock,
  ensureFreshAgencyTokenMock,
  mintLocationTokenMock,
  ghlApiCallMock,
} = vi.hoisted(() => ({
  stageConnectorActionMock: vi.fn(async (_input: unknown) => ({
    inboxItemId: "inbox_1",
    actionApprovalId: "appr_1",
    connectorActionLogId: "log_1",
    autoApproved: false,
  })),
  fetchSyncedLocationMock: vi.fn(
    async (_ownerId: string, _locationId: string): Promise<unknown> => null,
  ),
  fetchGhlConnectionFullMock: vi.fn(async (_ownerId: string): Promise<unknown> => null),
  insertGhlActionLogMock: vi.fn(async (_row: unknown) => undefined),
  resolveGhlAccessMock: vi.fn(async (_ownerId: string): Promise<unknown> => null),
  ensureFreshAgencyTokenMock: vi.fn(async (_conn: unknown): Promise<unknown> => null),
  mintLocationTokenMock: vi.fn(
    async (_token: string, _companyId: string, _locationId: string): Promise<unknown> => null,
  ),
  ghlApiCallMock: vi.fn(async (_input: unknown, _schema: unknown): Promise<unknown> => null),
}));

vi.mock("@/lib/orchestrator/tool-use", () => ({
  stageConnectorAction: stageConnectorActionMock,
  payloadHash: () => "hash1234",
}));

vi.mock("../store", () => ({
  fetchSyncedLocation: fetchSyncedLocationMock,
  fetchGhlConnectionFull: fetchGhlConnectionFullMock,
  insertGhlActionLog: insertGhlActionLogMock,
}));

vi.mock("../entitlement", () => ({
  resolveGhlAccess: resolveGhlAccessMock,
}));

vi.mock("../oauth", () => ({
  ensureFreshAgencyToken: ensureFreshAgencyTokenMock,
  mintLocationToken: mintLocationTokenMock,
}));

vi.mock("../client", () => ({
  ghlApiCall: ghlApiCallMock,
}));

import {
  BookAppointmentPayloadSchema,
  CreateContactPayloadSchema,
  executeGhlAction,
  GHL_ACTION_NAMES,
  GHL_CONNECTOR,
  SendSmsPayloadSchema,
  stageGhlWriteAction,
} from "../writes";
import { isConnectorActionNeverAutoApprove } from "@/lib/orchestrator/tier-caps";

const SMS_PAYLOAD = { locationId: "loc_A", contactId: "ct_1", body: "Quote follow-up: still want the Tuesday slot?" };

beforeEach(() => {
  resolveGhlAccessMock.mockResolvedValue({
    allowed: true,
    clientCap: 3,
    source: "tier",
    tier: "pro_plus",
  });
  fetchSyncedLocationMock.mockResolvedValue({
    ok: true,
    data: {
      id: "row_1",
      owner_id: "owner_1",
      connection_id: "conn_1",
      ghl_location_id: "loc_A",
      name: "Riverside Med Spa",
      timezone: null,
      address: null,
      sync_state: "synced",
      last_synced_at: null,
    },
  });
  fetchGhlConnectionFullMock.mockResolvedValue({
    ok: true,
    data: {
      id: "conn_1",
      owner_id: "owner_1",
      agency_company_id: "comp_1",
      status: "active",
      user_type: "Company",
      access_token_encrypted: "enc",
      refresh_token_encrypted: "enc",
      token_expires_at: null,
      agency_location_id: null,
      scopes: [],
      created_at: "",
      updated_at: "",
    },
  });
  ensureFreshAgencyTokenMock.mockResolvedValue({ ok: true, data: "agency_at" });
  mintLocationTokenMock.mockResolvedValue({ ok: true, data: "location_at" });
  ghlApiCallMock.mockResolvedValue({ ok: true, data: { conversationId: "cv_9" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("payload schemas", () => {
  it("create_contact needs a locationId and at least one identifying field", () => {
    expect(
      CreateContactPayloadSchema.safeParse({ locationId: "loc_A", contact: {} }).success,
    ).toBe(false);
    expect(
      CreateContactPayloadSchema.safeParse({ locationId: "", contact: { name: "Sam" } }).success,
    ).toBe(false);
    expect(
      CreateContactPayloadSchema.safeParse({
        locationId: "loc_A",
        contact: { name: "Sam Ortega", phone: "+15550100" },
      }).success,
    ).toBe(true);
  });

  it("send_sms bounds the body and requires the contact", () => {
    expect(SendSmsPayloadSchema.safeParse(SMS_PAYLOAD).success).toBe(true);
    expect(SendSmsPayloadSchema.safeParse({ ...SMS_PAYLOAD, body: "" }).success).toBe(false);
    expect(
      SendSmsPayloadSchema.safeParse({ ...SMS_PAYLOAD, body: "x".repeat(1601) }).success,
    ).toBe(false);
    expect(SendSmsPayloadSchema.safeParse({ locationId: "loc_A", body: "hi" }).success).toBe(false);
  });

  it("book_appointment requires calendar, contact, and a start", () => {
    expect(
      BookAppointmentPayloadSchema.safeParse({
        locationId: "loc_A",
        contactId: "ct_1",
        calendarId: "cal_1",
        startAt: "2026-07-10T15:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      BookAppointmentPayloadSchema.safeParse({
        locationId: "loc_A",
        contactId: "ct_1",
        startAt: "2026-07-10T15:00:00Z",
      }).success,
    ).toBe(false);
  });
});

describe("approval gate", () => {
  it("staging writes an action_approval card whose title names the client", async () => {
    const staged = await stageGhlWriteAction({
      userId: "owner_1",
      subAgentRunId: null,
      action: "send_sms",
      payload: SMS_PAYLOAD,
      declaredScopes: ["ghl:send_sms"],
      locationName: "Riverside Med Spa",
    });
    expect(staged.inboxItemId).toBe("inbox_1");
    const input = stageConnectorActionMock.mock.calls[0]?.[0] as unknown as {
      title: string;
      kind: string;
      connector: string;
      preview: string;
    };
    expect(input.connector).toBe(GHL_CONNECTOR);
    expect(input.kind).toBe("action_approval");
    expect(input.title).toContain("Riverside Med Spa");
    expect(input.preview).toContain("loc_A");
  });

  it("staging never calls the GHL API — execution is a separate, approval-only path", async () => {
    await stageGhlWriteAction({
      userId: "owner_1",
      subAgentRunId: null,
      action: "send_sms",
      payload: SMS_PAYLOAD,
      declaredScopes: ["ghl:send_sms"],
      locationName: "Riverside Med Spa",
    });
    expect(ghlApiCallMock).not.toHaveBeenCalled();
    expect(mintLocationTokenMock).not.toHaveBeenCalled();
  });

  it("all three v1 actions are pinned never-auto-approve (Infinity trust window)", () => {
    for (const action of GHL_ACTION_NAMES) {
      expect(isConnectorActionNeverAutoApprove("ghl", action), action).toBe(true);
    }
  });

  it("staging rejects a malformed payload before it reaches the Inbox", async () => {
    await expect(
      stageGhlWriteAction({
        userId: "owner_1",
        subAgentRunId: null,
        action: "send_sms",
        payload: { locationId: "loc_A" },
        declaredScopes: ["ghl:send_sms"],
        locationName: "Riverside Med Spa",
      }),
    ).rejects.toThrow(/payload invalid/);
    expect(stageConnectorActionMock).not.toHaveBeenCalled();
  });
});

describe("executeGhlAction", () => {
  it("executes an approved SMS against the payload's location and logs the audit row", async () => {
    const res = await executeGhlAction({
      userId: "owner_1",
      action: "send_sms",
      payload: SMS_PAYLOAD,
      requestId: "appr_1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.summary).toContain("Riverside Med Spa");
    expect(mintLocationTokenMock).toHaveBeenCalledWith("agency_at", "comp_1", "loc_A");
    expect(insertGhlActionLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "executed", ghlLocationId: "loc_A" }),
    );
  });

  it("blocks without a tier or pass entitlement — and never touches GHL", async () => {
    resolveGhlAccessMock.mockResolvedValue({ allowed: false, clientCap: 0, source: null, tier: "pro" });
    const res = await executeGhlAction({
      userId: "owner_1",
      action: "send_sms",
      payload: SMS_PAYLOAD,
      requestId: "appr_1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(ghlApiCallMock).not.toHaveBeenCalled();
    expect(insertGhlActionLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "blocked" }),
    );
  });

  it("multi-tenant: an action aimed at a location outside the owner's synced registry is blocked", async () => {
    // Location B exists in someone's GHL — but not in THIS owner's synced rows.
    fetchSyncedLocationMock.mockResolvedValue({ ok: true, data: null });
    const res = await executeGhlAction({
      userId: "owner_1",
      action: "send_sms",
      payload: { ...SMS_PAYLOAD, locationId: "loc_B" },
      requestId: "appr_1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(fetchSyncedLocationMock).toHaveBeenCalledWith("owner_1", "loc_B");
    expect(mintLocationTokenMock).not.toHaveBeenCalled();
    expect(ghlApiCallMock).not.toHaveBeenCalled();
  });

  it("an over-cap location is not executable (fetchSyncedLocation only returns synced rows)", async () => {
    // The store query filters sync_state=eq.synced, so an over_cap row resolves to null here —
    // the cap holds at execute time, not just in the UI.
    fetchSyncedLocationMock.mockResolvedValue({ ok: true, data: null });
    const res = await executeGhlAction({
      userId: "owner_1",
      action: "create_contact",
      payload: { locationId: "loc_over_cap", contact: { name: "Sam" } },
      requestId: "appr_2",
    });
    expect(res.ok).toBe(false);
    expect(ghlApiCallMock).not.toHaveBeenCalled();
  });

  it("rejects unknown actions and malformed payloads", async () => {
    const unknown = await executeGhlAction({
      userId: "owner_1",
      action: "delete_everything",
      payload: {},
      requestId: null,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.status).toBe(400);

    const malformed = await executeGhlAction({
      userId: "owner_1",
      action: "send_sms",
      payload: { locationId: "loc_A" },
      requestId: null,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.status).toBe(422);
    expect(ghlApiCallMock).not.toHaveBeenCalled();
  });

  it("a failed GHL call reports failure and logs it — no silent success", async () => {
    ghlApiCallMock.mockResolvedValue({ ok: false, status: 422, error: "bad phone", authError: false });
    const res = await executeGhlAction({
      userId: "owner_1",
      action: "send_sms",
      payload: SMS_PAYLOAD,
      requestId: "appr_1",
    });
    expect(res.ok).toBe(false);
    expect(insertGhlActionLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
